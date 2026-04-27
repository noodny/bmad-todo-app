import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/PageBanner";

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("ErrorBoundary caught:", error, info.componentStack); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="mx-auto max-w-150 p-4 md:p-8 pt-8 md:pt-16">
        <PageBanner
          icon={<AlertCircle className="size-5" />}
          message="Something went wrong. Reload the page."
          action={<Button variant="outline" size="default" onClick={() => window.location.reload()}>Reload</Button>}
        />
      </main>
    );
  }
}
