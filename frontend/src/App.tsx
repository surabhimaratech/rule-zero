import WorldGraph from "./components/WorldGraph";
import "./App.css";

function App() {
  return (
    <main className="app">
      <header className="app-header">
        <div>
          <div className="eyebrow">WORLD SIMULATION</div>
          <h1>RULE ZERO</h1>
          <p>Set the rules. Trace the consequences.</p>
        </div>
      </header>

      <WorldGraph />
    </main>
  );
}

export default App;