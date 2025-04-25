import { fetchGame, getActiveLiveGame, insertAnswer } from "../utils/api";
import { Agent } from "@mastra/core/agent";
import { GameData, WebSocketMessage } from "../types";
import { mastra } from "../mastra";
import wsService from "../services/ws";

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

const processGame = async (cryptoAgent: Agent, gameData: GameData) => {
  try {
    console.log("Processing game", gameData.id);
    const game = await fetchGame(gameData.id);
    if (!game) {
      console.log("Game not found");
      return;
    }

    const baseAsset = game.data.token.baseAsset;
    const quoteAsset = game.data.quoteAsset;

    console.log(
      `Processing game ${gameData.id} for ${baseAsset}/${quoteAsset}`
    );

    const fullQuery = query(baseAsset, quoteAsset);

    const result = await cryptoAgent
      .generate(fullQuery)
      .then((result) => {
        console.log("Raw agent response text:", result.text);

        let parsedResult;
        try {
          parsedResult = JSON.parse(result.text);
        } catch (parseError) {
          console.error("Failed to parse agent response as JSON:", parseError);
          console.error("Raw text that failed parsing:", result.text);
          throw new Error("Agent response was not valid JSON.");
        }

        if (
          parsedResult.decision !== "LONG" &&
          parsedResult.decision !== "SHORT"
        ) {
          console.error("Invalid recommendation:", parsedResult.decision);
          throw new Error("Invalid recommendation");
        }

        return insertAnswer({
          answer: parsedResult.decision.toLowerCase() as "long" | "short",
        }).then(() => parsedResult);
      })
      .catch((error) => {
        console.error("Error during agent generation or processing:", error);
        throw error;
      });

    console.log("Final result:", result);
  } catch (error) {
    console.error("Error in processGame:", error);
  }
};

const main = async () => {
  console.log("Starting main");
  const cryptoAgent = mastra.getAgent("cryptoAgent");

  const activeGame = await getActiveLiveGame();
  if (activeGame?.data) {
    console.log("Active game found:", activeGame?.data);
    await processGame(cryptoAgent, activeGame?.data);
  }

  wsService
  .connect()
  .then(() => {
    console.log('Connected to WebSocket');

    wsService.onMessage(async (message: object) => {
      const gameData = (message as WebSocketMessage).data;
      console.log('Received data from ws');
      await processGame(cryptoAgent, gameData);
    });
  })
    .catch((error) => {
      console.log("Failed to connect:", error);
    });
};

main();