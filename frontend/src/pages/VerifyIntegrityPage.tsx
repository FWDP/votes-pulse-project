import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, ShieldCheck, XCircle } from 'lucide-react'
import { useParams } from 'react-router-dom'

import type { PublicIntegrityVerification } from '../../../shared/integrityArtifacts'
import { getApiUrl } from '../utils/getApiUrl'

export default function VerifyIntegrityPage() {
  const { receipt = '' } = useParams()
  const [verification, setVerification] = useState<PublicIntegrityVerification | null>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const controller = new AbortController()
    void fetch(getApiUrl(`/api/verify/${encodeURIComponent(receipt)}`), { signal: controller.signal })
      .then(async response => {
        const body = await response.json() as { data?: PublicIntegrityVerification; error?: string }
        if (!response.ok || !body.data) throw new Error(body.error ?? `Verification API returned ${response.status}`)
        setVerification(body.data)
      })
      .catch(cause => {
        if ((cause as Error).name !== 'AbortError') setError(cause instanceof Error ? cause.message : 'Verification failed.')
      })
    return () => controller.abort()
  }, [receipt])

  const network = verification?.network === 'public' ? 'public' : 'testnet'
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <span className="rounded-xl bg-violet-600 p-3"><ShieldCheck size={28} /></span>
          <div><h1 className="text-2xl font-black">VOTES integrity verification</h1><p className="text-sm text-slate-400">Independent Stellar receipt check</p></div>
        </div>
        {!verification && !error && <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">Checking Stellar receipt…</div>}
        {error && <div className="rounded-xl border border-red-800 bg-red-950/50 p-6"><div className="flex items-center gap-2 font-bold text-red-300"><XCircle size={20} />Receipt not verified</div><p className="mt-2 text-sm text-red-200">{error}</p></div>}
        {verification && (
          <section className={`rounded-xl border p-6 ${verification.verified ? 'border-emerald-700 bg-emerald-950/30' : 'border-red-700 bg-red-950/30'}`}>
            <div className="flex items-center gap-2 text-xl font-black">
              {verification.verified ? <CheckCircle2 className="text-emerald-400" /> : <XCircle className="text-red-400" />}
              {verification.verified ? 'Verified integrity chain' : 'Integrity chain is incomplete'}
            </div>
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-400">Record</dt><dd className="font-semibold">{verification.artifactType ?? 'Field report'} · revision {verification.revision}</dd></div>
              <div><dt className="text-slate-400">Network</dt><dd className="font-semibold capitalize">{verification.network}</dd></div>
              <div><dt className="text-slate-400">Soroban state</dt><dd className="font-semibold">{verification.onChainVerified ? 'Checked directly' : 'Not confirmed'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-slate-400">Content hash</dt><dd className="break-all font-mono text-xs">{verification.contentHash}</dd></div>
              {verification.subjectHash && <div className="sm:col-span-2"><dt className="text-slate-400">Subject SHA-256</dt><dd className="break-all font-mono text-xs">{verification.subjectHash}</dd></div>}
              <div><dt className="text-slate-400">Ledger</dt><dd>{verification.ledgerSequence ?? 'Pending'}</dd></div>
              <div><dt className="text-slate-400">Confirmed</dt><dd>{verification.confirmedAt ? new Date(verification.confirmedAt).toLocaleString() : 'Pending'}</dd></div>
            </dl>
            {verification.transactionHash && <a className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900" href={`https://stellar.expert/explorer/${network}/tx/${verification.transactionHash}`} target="_blank" rel="noreferrer">View Stellar transaction <ExternalLink size={15} /></a>}
            <p className="mt-6 text-xs leading-5 text-slate-400">This page exposes only cryptographic proof and ledger metadata. The underlying report or artifact remains private.</p>
            {verification.verifiedAt && <p className="mt-1 text-xs text-slate-500">Checked {new Date(verification.verifiedAt).toLocaleString()}</p>}
          </section>
        )}
      </div>
    </main>
  )
}
