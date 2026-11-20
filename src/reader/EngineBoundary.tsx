import { Component, type ReactNode } from "react";
export class EngineBoundary extends Component<
  { children: ReactNode; fail: (e: Error) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.fail(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
