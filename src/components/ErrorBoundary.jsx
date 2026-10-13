import { Component } from 'react';

// Catches render-time crashes anywhere below it. Without this a single bad
// state leaves a blank white page and no clue what happened; here the player
// gets the library's own styling plus a way out.

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the detail in the console for whoever is debugging; the UI stays
    // calm on purpose.
    console.error('[whitebox] render failed', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="wb-shell">
        <main className="wb-main">
          <h1 className="wb-brand">WhiteBox</h1>
          <section className="wb-row">
            <h2 className="wb-row-title">Something broke</h2>
            <p className="wb-row-empty">
              The library failed to render. Reloading usually fixes it.
            </p>
            <button
              type="button"
              className="wb-reload-btn"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </section>
        </main>
      </div>
    );
  }
}