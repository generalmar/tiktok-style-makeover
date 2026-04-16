import { useState } from "react";
import NavBar from "@/components/NavBar";
import QuestionBank from "@/components/QuestionBank";
import type { Question } from "@/components/QuestionBank";
import GameStage from "@/components/GameStage";
import LiveFeed from "@/components/LiveFeed";

const initialQuestions: Question[] = [
  { id: 1, text: "What is 15% of 200?", difficulty: "easy", category: "Math", selected: false },
  { id: 2, text: "What does HTTP stand for?", difficulty: "hard", category: "Technology", selected: false },
  { id: 3, text: "Who painted the Mona Lisa?", difficulty: "easy", category: "Art", selected: false },
  { id: 4, text: "What is the square root of 144?", difficulty: "easy", category: "Math", selected: false },
  { id: 5, text: "Which planet in our solar system has the most moons?", difficulty: "medium", category: "Science", selected: false },
  { id: 6, text: "What is the maximum length of a TikTok video as of 2023?", difficulty: "medium", category: "TikTok", selected: false },
  { id: 7, text: "Which company originally developed the app that became TikTok?", difficulty: "medium", category: "TikTok", selected: false },
];

const Index = () => {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);

  const handleToggle = (id: number) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, selected: !q.selected } : q))
    );
  };

  const handleDelete = (id: number) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleReset = () => {
    setQuestions(initialQuestions);
  };

  const selectedCount = questions.filter((q) => q.selected).length;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <NavBar />
      <div className="flex-1 flex overflow-hidden">
        <QuestionBank questions={questions} onToggle={handleToggle} onDelete={handleDelete} />
        <GameStage status="idle" selectedCount={selectedCount} onReset={handleReset} />
        <LiveFeed />
      </div>
    </div>
  );
};

export default Index;
