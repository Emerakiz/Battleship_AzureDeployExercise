import React, { useCallback, useMemo, useRef, useState } from "react";

// ---------- Typer & konstanter ----------

type CellState = "empty" | "ship" | "hit" | "miss";
type Board = CellState[][];

const SIZE = 8;
const SHIP_SIZES = [4, 3, 2]; // en fyra, en trea, en tvåa

// ---------- Hjälpfunktioner för brädet ----------

function createEmptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<CellState>(SIZE).fill("empty"));
}

function isInside(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function canPlace(board: Board, row: number, col: number, size: number, horizontal: boolean): boolean {
  for (let i = 0; i < size; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;
    if (!isInside(r, c)) return false;

    // Kräv minst en tom ruta runt skeppet
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (isInside(nr, nc) && board[nr][nc] === "ship") return false;
      }
    }
  }
  return true;
}

function placeRandomShips(): Board {
  const board = createEmptyBoard();
  for (const size of SHIP_SIZES) {
    let placed = false;
    while (!placed) {
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * SIZE);
      const col = Math.floor(Math.random() * SIZE);

      if (canPlace(board, row, col, size, horizontal)) {
        for (let i = 0; i < size; i++) {
          const r = horizontal ? row : row + i;
          const c = horizontal ? col + i : col;
          board[r][c] = "ship";
        }
        placed = true;
      }
    }
  }
  return board;
}

function allShipsSunk(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== "ship"));
}

function colLetter(c: number): string {
  return String.fromCharCode("A".charCodeAt(0) + c);
}

// ---------- Komponent ----------

export default function BattleshipGame() {
  const [playerBoard, setPlayerBoard] = useState<Board>(() => placeRandomShips());
  const [enemyBoard, setEnemyBoard] = useState<Board>(() => placeRandomShips());
  const [message, setMessage] = useState("Your turn - click on a cell in the enemy ocean.");
  const [gameOver, setGameOver] = useState(false);

  // AI-state: kö av rutor att testa efter en träff, samt redan testade rutor
  const aiQueue = useRef<[number, number][]>([]);
  const aiTried = useRef<Set<string>>(new Set());

  const resetGame = useCallback(() => {
    setPlayerBoard(placeRandomShips());
    setEnemyBoard(placeRandomShips());
    setMessage("Your turn - click on a cell in the enemy ocean.");
    setGameOver(false);
    aiQueue.current = [];
    aiTried.current = new Set();
  }, []);

  const enqueueNeighbors = (row: number, col: number) => {
    const deltas = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of deltas) {
      const nr = row + dr;
      const nc = col + dc;
      const key = `${nr},${nc}`;
      if (isInside(nr, nc) && !aiTried.current.has(key)) {
        aiQueue.current.push([nr, nc]);
      }
    }
  };

  const aiTurn = (board: Board): Board => {
    let row: number, col: number;

    do {
      if (aiQueue.current.length > 0) {
        [row, col] = aiQueue.current.shift()!;
      } else {
        row = Math.floor(Math.random() * SIZE);
        col = Math.floor(Math.random() * SIZE);
      }
    } while (aiTried.current.has(`${row},${col}`));

    aiTried.current.add(`${row},${col}`);

    const newBoard = board.map((r) => [...r]);
    const cell = newBoard[row][col];

    if (cell === "ship") {
      newBoard[row][col] = "hit";
      setMessage((m) => `Bot fired at ${colLetter(col)}${row + 1} - Hit! ${m.split(" - ")[0]}`);
      enqueueNeighbors(row, col);
    } else {
      newBoard[row][col] = "miss";
      setMessage((m) => `Bot fired at ${colLetter(col)}${row + 1} - Miss.`);
    }
    return newBoard;
  };

  const handleFire = (row: number, col: number) => {
    if (gameOver) return;
    const current = enemyBoard[row][col];
    if (current === "hit" || current === "miss") return;

    const newEnemyBoard = enemyBoard.map((r) => [...r]);
    const wasShip = current === "ship";
    newEnemyBoard[row][col] = wasShip ? "hit" : "miss";
    setEnemyBoard(newEnemyBoard);

    if (wasShip && allShipsSunk(newEnemyBoard)) {
      setMessage("You won! All enemy ships have been sunk.");
      setGameOver(true);
      return;
    }

    setMessage(wasShip ? "Hit! Bots turn..." : "Miss. Bots turn...");

    // Datorns drag, med liten fördröjning för känsla
    setTimeout(() => {
      const newPlayerBoard = aiTurn(playerBoard);
      setPlayerBoard(newPlayerBoard);

      if (allShipsSunk(newPlayerBoard)) {
        setMessage("Bot won! All your ships have been sunk.");
        setGameOver(true);
      } else {
        setMessage((m) => `${m} Your turn.`);
      }
    }, 400);
  };

  const columns = useMemo(() => Array.from({ length: SIZE }, (_, i) => i), []);

  const renderBoard = (board: Board, isEnemy: boolean) => (
    <div style={styles.boardWrapper}>
      <div style={styles.headerRow}>
        <div style={styles.cornerCell} />
        {columns.map((c) => (
          <div key={c} style={styles.headerCell}>
            {colLetter(c)}
          </div>
        ))}
      </div>
      {board.map((rowData, r) => (
        <div key={r} style={styles.row}>
          <div style={styles.headerCell}>{r + 1}</div>
          {rowData.map((cell, c) => {
            const clickable = isEnemy && !gameOver && cell !== "hit" && cell !== "miss";
            const showShip = !isEnemy && cell === "ship";
            return (
              <div
                key={c}
                onClick={clickable ? () => handleFire(r, c) : undefined}
                style={{
                  ...styles.cell,
                  cursor: clickable ? "pointer" : "default",
                  background:
                    cell === "hit"
                      ? "#e74c3c"
                      : cell === "miss"
                      ? "#95a5a6"
                      : showShip
                      ? "#2c3e50"
                      : "#3498db",
                }}
              >
                {cell === "hit" ? "X" : cell === "miss" ? "o" : showShip ? "#" : ""}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Battleship</h1>
      <p style={styles.message}>{message}</p>
      <div style={styles.boards}>
        <div>
          <h3 style={styles.subtitle}>Your Ocean</h3>
          {renderBoard(playerBoard, false)}
        </div>
        <div>
          <h3 style={styles.subtitle}>Enemy Ocean</h3>
          {renderBoard(enemyBoard, true)}
        </div>
      </div>
      {gameOver && (
        <button style={styles.button} onClick={resetGame}>
          Play Again
        </button>
      )}
    </div>
  );
}

// ---------- Enkla inline-stilar ----------

const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: "sans-serif", textAlign: "center", padding: 20 },
  title: { marginBottom: 4 },
  subtitle: { marginBottom: 8 },
  message: { minHeight: 24, fontWeight: 600 },
  boards: { display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap" },
  boardWrapper: { display: "inline-block" },
  headerRow: { display: "flex" },
  row: { display: "flex" },
  headerCell: {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
  },
  cornerCell: { width: 32, height: 32 },
  cell: {
    width: 32,
    height: 32,
    margin: 1,
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: 700,
    userSelect: "none",
  },
  button: {
    marginTop: 20,
    padding: "8px 16px",
    fontSize: 14,
    cursor: "pointer",
  },
};