export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function notFound(message = "Resource not found") {
  return new ApiError(404, message);
}

export function forbidden(message = "You do not have permission to perform this action") {
  return new ApiError(403, message);
}

export function badRequest(message = "Invalid request") {
  return new ApiError(400, message);
}

export function handleErrors(err, _req, res, _next) {
  if (err?.name === "ZodError") {
    return res.status(400).json({
      message: "Validation failed",
      errors: err.errors.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  if (err?.code === "P2002") {
    return res.status(409).json({ message: "A record with this value already exists" });
  }

  const status = err.status || 500;
  const message = status === 500 ? "Something went wrong" : err.message;

  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({ message });
}
