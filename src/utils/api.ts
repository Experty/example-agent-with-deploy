import { env } from '../config';
import { GameResponse } from '../types';

export const fetchGame = async (
  id: string
): Promise<GameResponse | undefined> => {
  const response = await fetch(`${env.API_URL}/api/v1/agents/games?id=${id}`);
  if (!response.ok) {
    if (response.status === 400) {
      return;
    }

    return;
  }

  const game = await response.json();

  return game;
};

interface AnswerPayload {
  answer: 'long' | 'short';
}

export const insertAnswer = async (payload: AnswerPayload) => {
  const response = await fetch(`${env.API_URL}/api/v1/agents/games`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': env.ALT_GAMES_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  return response.json();
};

export const getActiveLiveGame = async () => {
  const response = await fetch(`${env.API_URL}/api/v1/agents/games/active`, {
    method: 'GET',
    headers: {
      'X-Api-Key': env.ALT_GAMES_API_KEY,
    },
  });
  if (!response.ok) {
    return;
  }

  return response.json();
};