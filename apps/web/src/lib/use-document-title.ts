import { useEffect } from "react";

/**
 * Sets `document.title` for the lifetime of the calling component, restoring
 * the previous value on unmount. Re-runs whenever `title` changes.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
