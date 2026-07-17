import { Elysia } from "elysia";

export const errorPlugin = new Elysia()
  .onError(({ code, error, set }) => {
    // Check if it's a known Postgres Error (e.g. unique constraint violation)
    if (error && typeof error === 'object' && 'code' in error) {
      const pgError = error as { code: string; detail?: string; message: string };
      
      switch (pgError.code) {
        case "23505": // unique_violation
          set.status = 409;
          return {
            success: false,
            error: "Resource already exists. " + (pgError.detail || pgError.message),
          };
        case "23503": // foreign_key_violation
          set.status = 400;
          return {
            success: false,
            error: "Referenced resource does not exist. " + (pgError.detail || pgError.message),
          };
      }
    }

    // Default validation errors from Elysia/TypeBox
    if (code === "VALIDATION") {
      set.status = 400;
      return {
        success: false,
        error: "Validation failed",
        details: JSON.parse(error.message),
      };
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        success: false,
        error: "Not Found",
      };
    }

    // Generic fallback
    if (error instanceof Error) {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.code === "VALIDATION") {
          set.status = 400;
          return { success: false, error: parsed.message };
        }
        if (parsed.code === "NOT_FOUND") {
          set.status = 404;
          return { success: false, error: parsed.message };
        }
      } catch (e) {
        // Not JSON, continue to generic error
      }
    }

    set.status = 500;
    return {
      success: false,
      error: error instanceof Error ? error.message : "Internal Server Error",
    };
  });
