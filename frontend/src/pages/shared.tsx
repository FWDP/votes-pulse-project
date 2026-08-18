import React, { useEffect, useState } from 'react'

export type GeographyUnit = { code: string; name: string; provinceCode?: string }
export type District = { id: string; name: string }

export const topics: Array<[string, number, 'positive' | 'neutral' | 'negative']> = [
  ['Food prices & inflation', 86, 'negative'], ['Jobs and livelihood', 72, 'positive'],
  ['Flood control projects', 68, 'negative'], ['Healthcare access', 59, 'neutral'],
  ['Education quality', 52, 'positive'], ['Transport and traffic', 47, 'negative'],
]
export const regional = [
  ['NCR', 31, 35, 34, '58.4k'], ['CAR', 38, 39, 23, '8.7k'],
  ['Ilocos Region', 34, 36, 30, '17.2k'], ['Cagayan Valley', 40, 37, 23, '11.8k'],
  ['Central Luzon', 28, 33, 39, '29.1k'], ['CALABARZON', 26, 31, 43, '41.6k'],
]

export function Stacked({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  return <div className="demo-stacked"><i className="demo-positive" style={{ width: `${positive}%` }} /><i className="demo-neutral" style={{ width: `${neutral}%` }} /><i className="demo-negative" style={{ width: `${negative}%` }} /></div>
}