/******************************************************************************/
// Symbols
/******************************************************************************/

const STRICT = Symbol('return-(-1)-if-missing')
const COMPARER = Symbol('compare-function')
const UNSAFE = Symbol('array-could-be-unsorted')

/******************************************************************************/
// Helper
/******************************************************************************/

function ascending (a, b) {
  return a > b ? 1 : a < b ? -1 : 0
}

function binarySearch (arr, value, strict) {

  if (arr[UNSAFE])
    throw new UnsafeSortError('lastIndexOf')

  let min = 0
  let max = arr.length

  // in case the array is descending
  const descending = arr[min] > arr[max - 1]

  while (min < max) {
    const mid = (min + max) >> 1
    const _value = arr[mid]

    if (_value === value)
      return mid

    if (descending ? _value > value : _value < value)
      min = mid + 1
    else
      max = mid
  }

  return strict === STRICT ? -1 : min
}

function copySortedArray (sortedArray, toPush) {

  const copy = new SortedArray()

  copy.comparer = sortedArray.comparer
  copy.push(...toPush)
  copy[UNSAFE] = sortedArray[UNSAFE]

  return copy
}

/******************************************************************************/
// Errors
/******************************************************************************/

class UnsafeSortError extends Error {

  constructor (methodName) {
    super(`${methodName}() cannot be called on this SortedArray. It is potentially out of order. Call sort() before ${methodName}().`)
    this.name = 'UnsafeArrayError'
  }

}

/******************************************************************************/
// Main
/******************************************************************************/

class SortedArray extends Array {

  static get [Symbol.species] () {
    return Array
  }

  constructor (...args) {
    super(...args)
    this.sort()
  }

  get comparer () {
    return this[COMPARER]
  }

  [COMPARER] = ascending

  get unsafe () {
    return this[UNSAFE]
  }

  [UNSAFE] = false

  set comparer (compareFunc) {
    if (typeof compareFunc !== 'function')
      compareFunc = ascending

    this[COMPARER] = compareFunc
  }

  // Insertion sort
  sort (compare = this.comparer) {

    this.comparer = compare

    const { length } = this

    for (let i = 1; i < length; i++) {
      const item = this[i]

      // eslint-disable-next-line no-var
      for (var ii = i - 1; ii >= 0 && this.comparer(this[ii], item) > 0; ii--)
        this[ii + 1] = this[ii]

      this[ii + 1] = item
    }

    this[UNSAFE] = false

    return this
  }

  // Extended to return SortedArray

  filter (...args) {
    const filtered = super.filter(...args)
    return copySortedArray(this, filtered)
  }

  map (...args) {
    const mapped = super.map(...args)

    const mappedAsSortedArray = copySortedArray(this, mapped)
    mappedAsSortedArray[UNSAFE] = true

    return mappedAsSortedArray
  }

  slice (...args) {
    const sliced = super.slice(...args)
    return copySortedArray(this, sliced)
  }

  // reduce() does not need extending as it does not return an Array

  // UNSAFE FUNCTIONS

  push (...args) {
    this[UNSAFE] = true
    return super.push(...args)
  }

  unshift (...args) {
    this[UNSAFE] = true
    return super.unshift(...args)
  }

  splice (...args) {
    this[UNSAFE] = true
    return super.splice(...args)
  }

  copyWithin (...args) {
    this[UNSAFE] = true
    return super.copyWithin(...args)
  }

  reverse (...args) {
    this[UNSAFE] = true
    return super.reverse(...args)
  }

  concat (arr) {
    const concated = super.concat(arr)

    const concatedAsSortedArray = copySortedArray(this, concated)
    concatedAsSortedArray[UNSAFE] = true

    return concatedAsSortedArray
  }

  // pop, shift and fill do not need to be extended as they cannot
  // cause an array to become unsorted

  // REQUIRES SAFE

  lastIndexOf (value) {
    const index = binarySearch(this, value, STRICT)
    return index
  }

  indexOf (value) {
    let index = this.lastIndexOf(value)

    // Search returns the last index of a given value, where indexOf should
    // return the first
    while (this[index - 1] === value)
      index--

    return index
  }

  insert (value) {
    const index = binarySearch(this, value)

    // super.splice because this.splice will set unsafe, which is unecessary
    // because this function cannot pollute the order
    super.splice(index, 0, value)

    return index
  }

  remove (value) {
    const index = this.lastIndexOf(value)
    if (index > -1)
    // super.splice because this.splice will set unsafe, which is unecessary
    // because this function cannot pollute the order
      super.splice(index, 1)

    return index
  }
}

/******************************************************************************/
// Exports
/******************************************************************************/

export default SortedArray

export { SortedArray, UnsafeSortError }
