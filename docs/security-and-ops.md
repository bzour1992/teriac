## 12. Security, Compliance & HIPAA

Patient health data is **Protected Health Information (PHI)**. Multiple regulatory frameworks apply depending on deployment country:

| Country | Framework |
|---|---|
| USA | HIPAA, HITECH |
| EU | GDPR + national health laws |
| UAE | UAE Federal Law No. 2 of 2019 (Use of ICT in Health), DHA / DOH circulars |
| KSA | NPHIES, PDPL |
| Jordan | Personal Data Protection Law 2023 |

### 12.1 Encryption

- **At rest:** Enable MariaDB Transparent Data Encryption (TDE) on the data and log files. Encrypt S3 buckets with SSE-KMS for photo/report storage.
- **In transit:** TLS 1.2+ everywhere, including DB connections (`useSSL=true&requireSSL=true`).
- **Application-level field encryption** for the most sensitive columns (e.g., `NationalID`, `PassportNumber`) using a column encryption library (e.g., `EF.EncryptColumn`). This guards against DBA / backup-tape leaks.

### 12.2 Password & Auth

- `patients.OnlinePassword` **must** be argon2id-hashed (or bcrypt cost ≥ 12).
- `hcenterusers` has no password column → auth is via external IdP. Use **OIDC** (Keycloak / Auth0). Ensure MFA for admin and clinical accounts.
- JWT access tokens: short-lived (15 min), refresh tokens rotating (30 days max).
- Lockout after 5 failed logins.

### 12.3 Audit Trail (Beyond `__sys*`)

The `__sys*` columns track only the latest change. For compliance you need **append-only audit records**:

```sql
CREATE TABLE audit_log (
  AuditID         bigint AUTO_INCREMENT PRIMARY KEY,
  EventTime       datetime(6) NOT NULL,
  UserID          char(36) NOT NULL,
  HCenterID       char(36) NOT NULL,
  IPAddress       varchar(45) NOT NULL,
  Action          varchar(50) NOT NULL,     -- View | Create | Update | Delete | Export | Print
  EntityType      varchar(100) NOT NULL,    -- 'Patient', 'PatientVisit', etc.
  EntityID        char(36) NOT NULL,
  PatientContext  char(36) NULL,            -- always log which patient was touched
  ChangedFields   json NULL,
  PreviousValues  json NULL,
  NewValues       json NULL,
  CorrelationID   char(36) NOT NULL,
  INDEX idx_audit_hcenter_time (HCenterID, EventTime DESC),
  INDEX idx_audit_patient (PatientContext, EventTime DESC),
  INDEX idx_audit_user (UserID, EventTime DESC)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;
```

Log **every read** of PHI as well as writes (HIPAA "access" requirement).

### 12.4 Soft Delete

Apply consistently: introduce a `BaseAuditableEntity` with `IsDeleted`, `DeletedBy`, `DeletedAt`. Add EF global filter (`HasQueryFilter`).

### 12.5 Tenant Isolation Enforcement

**4 lines of defense:**

1. **JWT** — `hcenter_id` claim signed
2. **API middleware** — sets `TenantContext`
3. **EF global filter** — every query auto-filtered by `HCenterID`
4. **Sanity check before commit** — assert no `HCenterID` mismatch on any modified entity in `SaveChanges()`

### 12.6 Data Minimization & Patient Rights

- **Export endpoint** for GDPR Article 15 (subject access): `/admin/patients/{id}/export` → ZIP of all PHI.
- **Anonymization** for research exports: redact name, DOB to year, mobile, address.
- **Right-to-be-forgotten** flow: anonymize record rather than hard-delete (clinical data retention typically requires keeping medical records 10+ years).

### 12.7 Backups

| Backup | Frequency | Retention |
|---|---|---|
| Full DB dump (encrypted) | Daily 02:00 UTC | 30 days |
| Incremental binlog | Every hour | 7 days |
| Off-site copy | Daily | 1 year |
| Photo/report blob snapshots | Daily | 30 days |
| Restore drill | Quarterly | Document in DR runbook |

---

## 13. Performance & Scaling

### 13.1 Expected Query Patterns

| Pattern | Frequency | Optimization |
|---|---|---|
| Patient typeahead search | Very high | FULLTEXT idx on names + Redis cache for active center |
| Today's appointments by doctor | High | `(Doctor, ScheduledInDate)` idx + 1-min Redis cache |
| ICD-10 / CPT search | High | Meilisearch (sub-50ms) or FULLTEXT + Redis L2 |
| Patient visit history | Medium | `(PatientID, VisitDate DESC)` idx |
| Daily revenue report | Per shift | `(HCenterID, AddDate)` idx + materialized daily summary |
| Patient demographic dashboard | Low | Pre-aggregated nightly via Hangfire |

### 13.2 Partitioning Recommendations

For data growth beyond 10M rows:

```sql
-- Partition financial transactions by year (oldest archived to cold storage)
ALTER TABLE hcenterfinancaltransactions
  PARTITION BY RANGE (YEAR(AddDate)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p2026 VALUES LESS THAN (2027),
    PARTITION pmax  VALUES LESS THAN MAXVALUE
  );

-- patientvisits by visit year similarly
-- icd10-cm2012 by first character of Code (rare write, optimize reads via partition pruning is overkill — Meili is better)
```

### 13.3 Caching Strategy (Redis)

| Cache | TTL | Invalidation |
|---|---|---|
| Lookups (countries, races, marital, body systems) | 24h | On admin edit |
| HCenter settings | 1h | On settings update |
| User permissions | 15min | On permission change |
| Today's schedule per doctor | 60s | On schedule change (event) |
| Patient summary | 5min | On patient update |
| ICD/CPT search results | 1h | Static — invalidate on data refresh only |

### 13.4 Read Replicas

For multi-tenant with 50+ HCenters and 1000+ concurrent users:

- 1 primary (writes)
- 2 read replicas (round-robin for read-only endpoints: lists, reports, exports)
- Use `MariaDB MaxScale` or `ProxySQL` for routing

### 13.5 Background Jobs (Hangfire)

| Job | Schedule |
|---|---|
| Daily P&L roll-up | 02:30 UTC daily |
| Invoice age report | Weekly Monday 06:00 |
| Appointment reminder SMS | Hourly 08:00–20:00 |
| Cleanup expired sessions | Every 15 minutes |
| Audit log retention pruning | Monthly |
| ICD/CPT search index rebuild | Weekly Sunday 03:00 |

---


## 15. Deployment & DevOps

### 15.1 Containerization

```dockerfile
# Dockerfile (api)
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS build
WORKDIR /src
COPY ["src/Teriac.Api/Teriac.Api.csproj", "src/Teriac.Api/"]
RUN dotnet restore "src/Teriac.Api/Teriac.Api.csproj"
COPY . .
RUN dotnet publish "src/Teriac.Api/Teriac.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
USER 1000
ENTRYPOINT ["dotnet", "Teriac.Api.dll"]
```

### 15.2 Docker Compose (dev)

```yaml
version: "3.9"
services:
  api:
    build: .
    ports: ["8080:8080"]
    environment:
      ConnectionStrings__Default: "Server=db;Database=teriac;User=root;Password=devpw;"
      Redis__Connection: "redis:6379"
      S3__Endpoint: "http://minio:9000"
      Keycloak__Authority: "http://keycloak:8080/realms/teriac"
    depends_on: [db, redis, minio, keycloak]
  db:
    image: mariadb:11
    environment:
      MARIADB_ROOT_PASSWORD: devpw
      MARIADB_DATABASE: teriac
    volumes: ["./data/db:/var/lib/mysql"]
    ports: ["3306:3306"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  meilisearch:
    image: getmeili/meilisearch:v1.5
    ports: ["7700:7700"]
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio12345
    ports: ["9000:9000", "9001:9001"]
  keycloak:
    image: quay.io/keycloak/keycloak:24
    command: start-dev
    ports: ["8081:8080"]
```

### 15.3 Kubernetes (prod)

| Component | Type | Replicas |
|---|---|---|
| `teriac-api` | Deployment | 3+ (HPA on CPU 60%) |
| `teriac-web` | Deployment | 2 (CDN-fronted) |
| `mariadb-primary` | StatefulSet | 1 |
| `mariadb-replica` | StatefulSet | 2 |
| `redis` | StatefulSet | 1 (or Redis Cluster 3) |
| `meilisearch` | StatefulSet | 1 |
| `keycloak` | Deployment | 2 |
| `hangfire-worker` | Deployment | 2 |

Ingress: NGINX with cert-manager. Storage: cloud block storage with daily snapshots.

### 15.4 CI/CD (GitHub Actions outline)

```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    services:
      mariadb:
        image: mariadb:11
        env: { MARIADB_ROOT_PASSWORD: test }
        ports: ["3306:3306"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: '8.0.x' }
      - run: dotnet restore
      - run: dotnet build --no-restore -c Release
      - run: dotnet test --no-build -c Release --logger trx
      - name: Security scan
        run: dotnet list package --vulnerable --include-transitive
      - name: Docker build & push
        if: github.ref == 'refs/heads/main'
        run: |
          docker build -t registry.example.com/teriac-api:${{ github.sha }} .
          docker push registry.example.com/teriac-api:${{ github.sha }}
```

### 15.5 Observability

- **Logs:** Serilog → Seq (dev) → Elastic (prod). Structured logs with `CorrelationId`, `HCenterId`, `UserId`, `PatientId`.
- **Metrics:** OpenTelemetry → Prometheus → Grafana. Custom metrics: visits-per-minute, invoice-generation-time, payment-success-rate.
- **Tracing:** OpenTelemetry → Tempo / Jaeger. Trace ID propagated to MariaDB query comments.
- **Alerting:** Grafana Alerting. Page on: API 5xx >1%, DB connection pool >80%, audit log write failures, anomalous bulk PHI access.

---

