import { Mastra } from '@mastra/core';
import { cryptoAgent } from './agents/crypto-agent';
import dotenv from 'dotenv';

dotenv.config();

export const mastra = new Mastra({
  agents: {
    cryptoAgent,
  },
});