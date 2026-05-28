import type { ReactNode } from "react";
import { BodySystemEditor } from "./BodySystemEditor";
import { getPhysicalExam, savePhysicalExam } from "./api";

interface Props {
  visitId: string;
  patientId: string;
  title?: ReactNode;
  id?: string;
}

export function PhysicalExamCard({ visitId, title, id }: Props): JSX.Element {
  return (
    <BodySystemEditor
      id={id}
      visitId={visitId}
      title={title ?? "Physical Examination"}
      queryKey="physical-exam"
      fetchEntries={getPhysicalExam}
      saveEntries={savePhysicalExam}
      saveLabel="Save PE"
    />
  );
}
