import { createProxy as createProxyToCompare, isChanged } from 'proxy-compare'
import { proxy, snapshot } from '../vanilla'
import type { DeepResolveType } from '../vanilla'

/**
 * proxyWithComputed
 *
 * This is to create a proxy with initial object and additional object,
 * which specifies getters for computed values with dependency tracking.
 * It also accepts optional setters for computed values.
 *
 * [Notes]
 * This comes with a cost and overlaps with useSnapshot.
 * Do not try to optimize too early. It can worsen the performance.
 * Measurement and comparison will be very important.
 *
 * @example
 * import { proxyWithComputed } from 'valtio/utils'
 * const state = proxyWithComputed({
 *   count: 1,
 * }, {
 *   doubled: snap => snap.count * 2, // getter only
 *   tripled: {
 *     get: snap => snap.count * 3,
 *     set: (state, newValue) => { state.count = newValue / 3 }
 *   }, // with optional setter
 * })
 */
export const proxyWithComputed = <T extends object, U extends object>(
  initialObject: T,
  computedFns: {
    [K in keyof U]:
      | ((snap: DeepResolveType<T>) => U[K])
      | {
          get: (snap: DeepResolveType<T>) => U[K]
          set?: (state: T, newValue: U[K]) => void
        }
  }
) => {
  ;(Object.keys(computedFns) as (keyof U)[]).forEach((key) => {
    if (Object.getOwnPropertyDescriptor(initialObject, key)) {
      throw new Error('object property already defined')
    }
    const computedFn = computedFns[key]
    const { get, set } = (
      typeof computedFn === 'function' ? { get: computedFn } : computedFn
    ) as {
      get: (snap: DeepResolveType<T>) => U[typeof key]
      set?: (state: T, newValue: U[typeof key]) => void
    }
    let computedValue: U[typeof key]
    let prevSnapshot: DeepResolveType<T> | undefined
    let affected = new WeakMap()
    const desc: PropertyDescriptor = {}
    desc.get = () => {
      const nextSnapshot = snapshot(proxyObject)
      if (!prevSnapshot || isChanged(prevSnapshot, nextSnapshot, affected)) {
        affected = new WeakMap()
        computedValue = get(createProxyToCompare(nextSnapshot, affected))
        prevSnapshot = nextSnapshot
      }
      return computedValue
    }
    if (set) {
      desc.set = (newValue) => set(proxyObject, newValue)
    }
    Object.defineProperty(initialObject, key, desc)
  })
  const proxyObject = proxy(initialObject) as T & U
  return proxyObject
}
