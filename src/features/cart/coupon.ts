import { useState } from 'react'

const COUPON_STORAGE_KEY = 'nft-marketplace-coupon'

/** Applied coupon persisted for the duration of the tab session (cart + checkout share it). */
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
      // ignore
    }
  }

  return [appliedCoupon, setAppliedCoupon] as const
}
