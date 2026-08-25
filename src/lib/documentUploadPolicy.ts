import { notifyError } from "../components/common/CrmNotifications";

export const DOCUMENT_FILE_LIMIT_BYTES = 1024 * 1024;
export const DOCUMENT_BATCH_LIMIT_BYTES = 20 * 1024 * 1024;

const formatMb = (bytes:number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

export function validateDocumentFiles(files:File[]):boolean {
  if (!files.length) return false;
  const oversized = files.find(file => file.size > DOCUMENT_FILE_LIMIT_BYTES);
  if (oversized) {
    notifyError("Document exceeds the 1 MB limit", `${oversized.name} is ${formatMb(oversized.size)}. Every individual document must be 1 MB or smaller.`);
    return false;
  }
  const total = files.reduce((sum,file)=>sum+file.size,0);
  if (total > DOCUMENT_BATCH_LIMIT_BYTES) {
    notifyError("Upload batch exceeds 20 MB", `The selected documents total ${formatMb(total)}. Reduce the batch to 20 MB or less.`);
    return false;
  }
  return true;
}
