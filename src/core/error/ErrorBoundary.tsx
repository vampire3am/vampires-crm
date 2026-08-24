import { Component, type ErrorInfo, type ReactNode } from "react";
import { supabase } from "../../lib/supabase";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; message: string }
> {
  state = { failed: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { failed: true, message: error.message || "Unknown application error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AECS application error", error, info);
    void supabase.rpc("record_client_error", {
      error_message: error.message,
      error_context: {
        component_stack: info.componentStack?.slice(0, 4000),
        path: location.pathname,
      },
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="fatal-error" role="alert">
        <h1>Something went wrong</h1>
        <p>{this.state.message}</p>
        <button onClick={() => location.reload()}>Reload workspace</button>
      </main>
    );
  }
}
