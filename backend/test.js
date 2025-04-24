// test.js - Simple QA test using HuggingFace transformers and fake data

async function runQATest() {
  // Use dynamic import for ES module
  const { pipeline } = await import('@xenova/transformers');
  // Fake context and question
  const context = `The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France. It is named after the engineer Gustave Eiffel, whose company designed and built the tower. Constructed from 1887 to 1889 as the entrance to the 1889 World's Fair, it was initially criticized by some of France's leading artists and intellectuals for its design, but it has become a global cultural icon of France and one of the most recognizable structures in the world.`;
  const question = 'Who designed the Eiffel Tower?';

  // Load QA pipeline
  const qa = await pipeline('question-answering', 'tomasmcm/deepset-roberta-base-squad2-onnx');

  try {
    const resultArgs = await qa(String(question), String(context));
    console.log('QA result (separate args):', resultArgs);
  } catch (err) {
    console.error('Error with separate args:', err);
  }

  console.log('Question:', question);
}

runQATest().catch(console.error);
