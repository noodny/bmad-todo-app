import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TaskInputProps {
  onSubmit: (text: string) => void;
}

const MAX_LENGTH = 200;

function TaskInput({ onSubmit }: TaskInputProps) {
  const [value, setValue] = useState("");
  const [showOverLimit, setShowOverLimit] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // AC1 — autofocus on mount. Belt-and-suspenders alongside the autoFocus
  // attribute, which can be unreliable in some Vite/React 19 setups.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    if (showOverLimit) setShowOverLimit(false);
  };

  // AC5 — native maxLength clamps typed input but does NOT reliably clamp
  // programmatic paste cross-browser. Compute the merged value, truncate
  // explicitly, and show the over-limit notice only when truncation
  // actually happened.
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    const target = e.currentTarget;
    const start = target.selectionStart ?? value.length;
    const end = target.selectionEnd ?? value.length;
    const merged = value.slice(0, start) + pasted + value.slice(end);
    if (merged.length > MAX_LENGTH) {
      e.preventDefault();
      const truncated = merged.slice(0, MAX_LENGTH);
      setValue(truncated);
      setShowOverLimit(true);
      requestAnimationFrame(() => {
        if (inputRef.current) {
          const cursor = Math.min(start + pasted.length, MAX_LENGTH);
          inputRef.current.setSelectionRange(cursor, cursor);
        }
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Skip Enter while an IME is composing (CJK/Korean/Japanese) so the
      // first Enter commits the IME candidate instead of submitting a
      // half-composed string.
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      if (e.shiftKey) return; // AC9
      const trimmed = value.trim();
      if (trimmed.length === 0) return; // AC13
      onSubmit(trimmed); // AC7
      setValue("");
      setShowOverLimit(false);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setValue("");
      setShowOverLimit(false);
      return;
    }
    // Tab and other keys: fall through to default browser handling.
  };

  const handleBlur = () => {
    setShowOverLimit(false); // AC6b
  };

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="task-input" className="sr-only">
        Add a task
      </Label>
      <Input
        ref={inputRef}
        id="task-input"
        type="text"
        placeholder="Task"
        value={value}
        maxLength={MAX_LENGTH}
        className="h-11 w-full"
        onChange={handleChange}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      {showOverLimit && (
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-muted-foreground"
        >
          Up to 200 characters
        </p>
      )}
    </div>
  );
}

export default TaskInput;
