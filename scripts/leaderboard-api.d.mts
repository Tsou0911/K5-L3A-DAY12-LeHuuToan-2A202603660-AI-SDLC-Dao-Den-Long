import type {IncomingMessage,ServerResponse} from 'node:http'
export interface LeaderboardEntry{name:string;score:number;nights_won:number;achieved_at:string;seed:number}
export function loadLeaderboard():Promise<LeaderboardEntry[]>
export function createLeaderboardMiddleware():(request:IncomingMessage,response:ServerResponse,next:()=>void)=>void
