import React, { useReducer } from 'react';
import { SlatraGameView } from '@/components/game/SlatraGameView';
import { gameReducer, createInitialState } from '@/game/gameReducer';

const SlatraGame: React.FC = () => {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  return <SlatraGameView state={state} dispatch={dispatch} exitPath="/" />;
};

export default SlatraGame;
