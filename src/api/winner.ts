import request from '@/api/request'
import { IPersonConfig, IPrizeConfig } from '@/types/storeType'

export type WinnerPayload = {
  uid: string
  name: string
  department: string
  identity: string
  prizeId: string | number
  prizeName: string
  prizeTime: string
}

export function saveWinners(payload: WinnerPayload[]) {
  return request<{ success: boolean } | any>({
    url: '/winners',
    method: 'POST',
    data: payload,
  })
}

// 立即暂存本轮产生的中奖结果（可回滚）
export function provisionalWinners(payload: WinnerPayload[]) {
  return request<{ success: boolean } | any>({
    url: '/winners/provisional',
    method: 'POST',
    data: payload,
  })
}

// 回滚本轮中奖结果（在取消时使用）
export function rollbackWinners(prizeId: string | number) {
  return request<{ success: boolean } | any>({
    url: '/winners/rollback',
    method: 'POST',
    data: { prizeId },
  })
}

// 同步奖品使用进度：用于保证 剩余 + 已中 = 总数
export function updatePrizeUsage(params: { prizeId: string | number, usedCount: number, total: number }) {
  const { prizeId, usedCount, total } = params
  return request<{ success: boolean } | any>({
    url: '/prizes/usage',
    method: 'POST',
    data: { prizeId, usedCount, remaining: total - usedCount, total },
  })
}

export function mapWinnersPayload(winners: IPersonConfig[], prize: IPrizeConfig): WinnerPayload[] {
  return winners.map((p) => ({
    uid: p.uid,
    name: p.name,
    department: p.department,
    identity: p.identity,
    prizeId: prize.id,
    prizeName: prize.name,
    prizeTime: new Date().toISOString(),
  }))
}


