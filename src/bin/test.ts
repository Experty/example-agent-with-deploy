import { mastra } from "../mastra";

const query = (baseAsset: string, quoteAsset: string) => `
  I'm interested in trading ${baseAsset} right now. Please analyze in full aspect the ${baseAsset} by:
  IMPORTANT: Use the exact symbol "${baseAsset}""${quoteAsset}" as provided.

  Based on all this data, tell me if I should go LONG or SHORT on ${baseAsset} for the next 15 minutes, and explain your reasoning.

  ### EXECUTION FLOW
  1. Call each agent exactly ONCE to gather their analysis and signals
  2. DO NOT call any agent multiple times - use only their first response
  3. Once all agent responses are collected, aggregate them to make the final decision
  4. Return the final decision in the specified JSON format

### OUTPUT FORMAT
IMPORTANT: Format your final answer as a JSON object with these fields:
{
  "decision": "LONG" | "SHORT",
  "reasoning": "string" // Explain that the decision was random after fetching price data.
}
DO NOT include any explanatory text outside of this JSON object.
`;

async function main() {
    console.log('Starting test');
    const baseAsset = 'SOL';
    const quoteAsset = 'USDT';
    const fullQuery = query(baseAsset, quoteAsset);

    const agent = mastra.getAgent('cryptoAgent');

    const result = await agent
    .generate(fullQuery)
    .then((result) => {
        console.log('Raw agent response text:', result.text);

        let parsedResult;
        try {
            parsedResult = JSON.parse(result.text);
        } catch (parseError) {
            console.error('Failed to parse agent response as JSON:', parseError);
            console.error('Raw text that failed parsing:', result.text);
            throw new Error('Agent response was not valid JSON.');
        }

        if (
            parsedResult.decision !== 'LONG' &&
            parsedResult.decision !== 'SHORT'
        ) {
            console.error('Invalid recommendation:', parsedResult.decision);
            throw new Error('Invalid recommendation');
        }

        return parsedResult;
    })
    .catch((error) => {
        console.error('Error during agent generation or processing:', error);
        throw error;
    });

    console.log('Final result:', result);
}

main().catch(console.error);