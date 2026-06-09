import { useEffect, useMemo, useState } from 'react'
import type { Member, Session } from '../types/app'

type PaymentMode = 'Cash' | 'GCash' | 'Others'
type PaymentSort = 'alphabetical' | 'paid'

type PaymentRecord = {
  paid: boolean
  mode: PaymentMode
  note: string
}

type PaymentState = {
  courtFee: number
  numOfHours: number
  shuttlecockPerTube: number
  numberOfTube: number
  individualPayment: number
  sortBy: PaymentSort
  payments: Record<string, PaymentRecord>
}

type PaymentPageProps = {
  session: Session
  memberById: Record<string, Member>
}

const paymentModes: PaymentMode[] = [
  'Cash',
  'GCash',
  'Others',
]

const formatMoney = (value: number) =>
  value.toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  })

const getPaymentStorageKey = (sessionId: string) =>
  `racket-arena:payment:${sessionId}`

const defaultPaymentState: PaymentState = {
  courtFee: 0,
  numOfHours: 0,
  shuttlecockPerTube: 0,
  numberOfTube: 0,
  individualPayment: 0,
  sortBy: 'alphabetical',
  payments: {},
}

const loadPaymentState = (sessionId: string): PaymentState => {
  try {
    const stored = window.localStorage.getItem(getPaymentStorageKey(sessionId))

    if (!stored) {
      return defaultPaymentState
    }

    return {
      ...defaultPaymentState,
      ...JSON.parse(stored),
    }
  } catch {
    return defaultPaymentState
  }
}

export function PaymentPage({ session, memberById }: PaymentPageProps) {
  const [paymentState, setPaymentState] = useState<PaymentState>(() =>
    loadPaymentState(session.id),
  )

  const {
    courtFee,
    numOfHours,
    shuttlecockPerTube,
    numberOfTube,
    individualPayment,
    sortBy,
    payments,
  } = paymentState

  useEffect(() => {
    window.localStorage.setItem(
      getPaymentStorageKey(session.id),
      JSON.stringify(paymentState),
    )
  }, [paymentState, session.id])

  const playerIds = useMemo(
    () => {
      const participatedIds = new Set([
        ...session.playingIds,
        ...Object.entries(session.stats)
          .filter(([, stats]) => stats.gamesPlayed >= 1)
          .map(([memberId]) => memberId),
      ])

      return [...participatedIds]
        .filter((memberId) => memberById[memberId])
        .sort((a, b) => memberById[a].name.localeCompare(memberById[b].name))
    },
    [session.playingIds, session.stats, memberById],
  )

  const sharedTotal =
    courtFee * numOfHours +
    shuttlecockPerTube * numberOfTube

  const contribution =
    playerIds.length > 0
      ? sharedTotal / playerIds.length + individualPayment
      : 0

  const totalToCollect =
    contribution * playerIds.length

  const paidCount =
    playerIds.filter((memberId) => payments[memberId]?.paid).length

  const paymentModeTotals = paymentModes.map((mode) => ({
    mode,
    amount: playerIds.reduce((total, memberId) => {
      const payment = payments[memberId]

      if (!payment?.paid || payment.mode !== mode) {
        return total
      }

      return total + contribution
    }, 0),
  }))

  const hasCollectedPayments = paymentModeTotals.some(
    ({ amount }) => amount > 0,
  )

  const sortedPlayerIds = useMemo(() => {
    if (sortBy === 'paid') {
      return [...playerIds].sort((a, b) => {
        const aPaid = payments[a]?.paid ? 1 : 0
        const bPaid = payments[b]?.paid ? 1 : 0

        if (aPaid !== bPaid) {
          return bPaid - aPaid
        }

        return memberById[a].name.localeCompare(memberById[b].name)
      })
    }

    return playerIds
  }, [memberById, payments, playerIds, sortBy])

  const updatePayment = (
    memberId: string,
    updater: (record: PaymentRecord) => PaymentRecord,
  ) => {
    setPaymentState((prev) => ({
      ...prev,
      payments: {
        ...prev.payments,
        [memberId]: updater(
          prev.payments[memberId] ?? {
            paid: false,
            mode: 'Cash',
            note: '',
          },
        ),
      },
    }))
  }

  const numberInput = (
    label: string,
    value: number,
    field: keyof Pick<
      PaymentState,
      | 'courtFee'
      | 'numOfHours'
      | 'shuttlecockPerTube'
      | 'numberOfTube'
      | 'individualPayment'
    >,
    step = '1',
  ) => (
    <label className="payment-field">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={(event) =>
          setPaymentState((prev) => ({
            ...prev,
            [field]: Number(event.target.value) || 0,
          }))
        }
      />
    </label>
  )

  return (
    <section className="payment-page stack">
      <article className="card payment-summary-card">
        <div className="payment-input-grid">
          {numberInput('Court Fee', courtFee, 'courtFee')}
          {numberInput('Number of Hours', numOfHours, 'numOfHours')}
          {numberInput('Shuttlecock Per Tube', shuttlecockPerTube, 'shuttlecockPerTube')}
          {numberInput('Number Of Tube/s      ', numberOfTube, 'numberOfTube', '0.1')}
          {numberInput('Individual Payment', individualPayment, 'individualPayment')}
        </div>

        <div className="payment-totals">
          <div>
            <span>Players</span>
            <strong>{playerIds.length}</strong>
          </div>
          <div>
            <span>Each Player</span>
            <strong>{formatMoney(contribution)}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{formatMoney(totalToCollect)}</strong>
          </div>
          <div>
            <span>Paid</span>
            <strong>
              {paidCount}/{playerIds.length}
            </strong>
          </div>
        </div>

        <div className="payment-mode-totals" aria-label="Payment totals by mode">
          {hasCollectedPayments ? (
            paymentModeTotals
              .filter(({ amount }) => amount > 0)
              .map(({ mode, amount }) => (
                <div key={mode} className="payment-mode-total">
                  <span>{mode}</span>
                  <strong>{formatMoney(amount)}</strong>
                </div>
              ))
          ) : (
            <p>No payments collected yet.</p>
          )}
        </div>
      </article>

      <article className="card">
        <div className="players-header">
          <h3>Payment</h3>
          <select
            value={sortBy}
            onChange={(event) =>
              setPaymentState((prev) => ({
                ...prev,
                sortBy: event.target.value as PaymentSort,
              }))
            }
          >
            <option value="alphabetical">Alphabetically</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        <div className="payment-list">
          {sortedPlayerIds.length === 0 && (
            <p className="available">No players have participated yet.</p>
          )}

          {sortedPlayerIds.length > 0 && (
            <div className="payment-table-wrap">
              <table className="payment-table">
                <thead>
                  <tr>
                    <th scope="col">Paid</th>
                    <th scope="col">Name</th>
                    <th scope="col">Mode of Payment</th>
                    <th scope="col">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayerIds.map((memberId) => {
                    const payment = payments[memberId] ?? {
                      paid: false,
                      mode: 'Cash',
                      note: '',
                    }

                    return (
                      <tr
                        key={memberId}
                        className={payment.paid ? 'payment-paid' : ''}
                      >
                        <td data-label="Paid">
                          <label
                            className="payment-paid-toggle"
                            aria-label={`Mark ${memberById[memberId].name} as paid`}
                          >
                            <input
                              type="checkbox"
                              checked={payment.paid}
                              onChange={(event) =>
                                updatePayment(memberId, (record) => ({
                                  ...record,
                                  paid: event.target.checked,
                                }))
                              }
                            />
                          </label>
                        </td>
                        <td data-label="Name">
                          <span className="payment-name">{memberById[memberId].name}</span>
                        </td>
                        <td data-label="Mode of Payment">
                          <label className="payment-row-field">
                            <select
                              value={payment.mode}
                              onChange={(event) =>
                                updatePayment(memberId, (record) => ({
                                  ...record,
                                  mode: event.target.value as PaymentMode,
                                }))
                              }
                            >
                              {paymentModes.map((mode) => (
                                <option key={mode} value={mode}>
                                  {mode}
                                </option>
                              ))}
                            </select>
                          </label>
                        </td>
                        <td data-label="Note">
                          <label className="payment-row-field">
                            <input
                              value={payment.note}
                              onChange={(event) =>
                                updatePayment(memberId, (record) => ({
                                  ...record,
                                  note: event.target.value,
                                }))
                              }
                              placeholder="Note / reference number"
                            />
                          </label>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </article>
    </section>
  )
}
