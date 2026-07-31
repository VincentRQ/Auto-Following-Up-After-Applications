import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

class ApplicationErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean; message: string }> {
  state = { failed: false, message: "" };
  static getDerivedStateFromError(error: Error) { return { failed: true, message: error.message }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error("Outreach Console render failure", error, info); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="fatal-recovery"><TerminalFallback /><h1>The console hit a display error</h1><p>Your imported rows and setup choices remain in local storage. Reload the app; if this repeats, download diagnostics from Setup after it opens.</p><code>{this.state.message}</code><button onClick={() => window.location.reload()}>Reload console</button></main>;
  }
}

function TerminalFallback() { return <span aria-hidden="true">&gt;_</span>; }

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ApplicationErrorBoundary><App /></ApplicationErrorBoundary>
  </React.StrictMode>,
);
