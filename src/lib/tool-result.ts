import { UserInputError } from "./errors.js";

export function toolError(error: unknown, fallbackMessage: string) {
  if (error instanceof UserInputError) {
    return {
      isError: true,
      content: [{ type: "text" as const, text: error.message }],
    };
  }
  console.error(error);
  return {
    isError: true,
    content: [{ type: "text" as const, text: fallbackMessage }],
  };
}

export function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
