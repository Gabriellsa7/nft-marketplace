import { useState } from 'react'

const COUPON_STORAGE_KEY = 'nft-marketplace-coupon'

export function useAppliedCoupon() {
  const [appliedCoupon, setAppliedCouponState] = useState<string | undefined>(() => {
    try {
      return sessionStorage.getItem(COUPON_STORAGE_KEY) ?? undefined
    } catch {
      return undefined
    }
  })

  function setAppliedCoupon(coupon: string | undefined) {
    setAppliedCouponState(coupon)
    try {
      if (coupon) sessionStorage.setItem(COUPON_STORAGE_KEY, coupon)
      else sessionStorage.removeItem(COUPON_STORAGE_KEY)
    } catch {
    }
  }

  return [appliedCoupon, setAppliedCoupon] as const
}
