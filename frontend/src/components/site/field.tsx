import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const control = "w-full border-[1.5px] bg-white px-5 text-base text-ink placeholder:text-muted-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-espresso aria-[invalid=true]:border-danger";

// Label + rounded control + error slot. The error is tied to the control with aria-describedby.
export function Field({ label, name, error, required, multiline, ...props }: {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  multiline?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "name" | "id">) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  const shared = { id, name, "aria-invalid": error ? true : undefined, "aria-describedby": error ? errorId : undefined, "aria-required": required || undefined };
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-[14px] font-bold text-espresso">
        {label}
        {required ? <span aria-hidden className="ml-1 text-caramel">*</span> : null}
      </label>
      {multiline ? (
        <textarea {...props} {...shared} rows={6} className={`${control} min-h-40 rounded-[20px] py-3.5 leading-[1.7] ${error ? "border-danger" : "border-line"}`} />
      ) : (
        <input {...props} {...shared} className={`${control} min-h-12 rounded-full ${error ? "border-danger" : "border-line"}`} />
      )}
      {error ? <p id={errorId} className="text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}
