// 把"净结果 net"合成为一条 buy_in + final_chips。
// 用于事后录入/导入：只知道净输赢时，构造满足以下条件的买入与最终筹码——
//   - amount 永远是 BUY_IN_UNIT 的整数倍
//   - final_chips 永远 >= 0
//   - final_chips - amount === net （净结果零误差）
// 单局守恒（Σfinal === Σamount）在 Σnet === 0 时自动成立。
export const BUY_IN_UNIT = 2000

export function synthFromNet(net: number): { amount: number; final_chips: number } {
  const amount = BUY_IN_UNIT * Math.max(1, Math.ceil(-net / BUY_IN_UNIT))
  return { amount, final_chips: amount + net }
}
