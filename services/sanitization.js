import { stripHtml } from "string-strip-html";

export default function sanitizeItems(item, ...OtherItems) {
  if (OtherItems.length === 0) {
    const sanitizedItem = stripHtml(item).result.trim();
    return sanitizedItem;
  } else {
    const sanitizedArray = OtherItems.map((item) =>
      stripHtml(item).result.trim()
    );
    return sanitizedArray;
  }
}
