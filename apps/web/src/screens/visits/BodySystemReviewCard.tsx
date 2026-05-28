import type { ReactNode } from "react";
import { BodySystemEditor } from "./BodySystemEditor";
import { getBodySystemReview, saveBodySystemReview } from "./api";

interface Props {
  visitId: string;
  patientId: string;
  title?: ReactNode;
  id?: string;
}

export function BodySystemReviewCard({ visitId, title, id }: Props): JSX.Element {
  return (
    <BodySystemEditor
      id={id}
      visitId={visitId}
      title={title ?? "Review of Systems"}
      queryKey="ros"
      fetchEntries={getBodySystemReview}
      saveEntries={saveBodySystemReview}
      saveLabel="Save ROS"
    />
  );
}
