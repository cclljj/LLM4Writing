export function parseStep9ReflectionAnswers(text: string): Map<number, string> {
  const answers = new Map<number, string>();
  let currentQuestion: number | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentQuestion === null) return;
    answers.set(currentQuestion, currentLines.join("\n").trim());
  };

  for (const line of text.split(/\r?\n/)) {
    const trimmedStart = line.trimStart();
    if (trimmedStart.startsWith("Q")) {
      const colonIndex = trimmedStart.indexOf(":");
      const rawQuestionNumber = colonIndex === -1 ? "" : trimmedStart.slice(1, colonIndex).trim();
      const questionNumber = Number(rawQuestionNumber);
      if (Number.isInteger(questionNumber) && questionNumber >= 1 && questionNumber <= 4) {
        flush();
        currentQuestion = questionNumber;
        currentLines = [trimmedStart.slice(colonIndex + 1).trimStart()];
        continue;
      }
    }
    if (currentQuestion !== null) {
      currentLines.push(line);
    }
  }
  flush();

  return answers;
}
