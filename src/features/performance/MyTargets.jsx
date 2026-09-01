import { Target, TrendingUp, CheckCircle2 } from 'lucide-react'
import Card from '../../components/ui/Card'

const targets = [
  { id: 1, name: 'Monthly Sales', target: 50000, achieved: 42000, unit: '₹ ' },
  { id: 2, name: 'New Customers', target: 20, achieved: 15, unit: '' },
  { id: 3, name: 'Orders Created', target: 50, achieved: 45, unit: '' },
  { id: 4, name: 'Visits Completed', target: 30, achieved: 28, unit: '' },
  { id: 5, name: 'Follow-ups Done', target: 40, achieved: 35, unit: '' },
]

export default function MyTargets() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">My Targets</h1>
        <p className="text-sm text-neutral-500">Track your monthly progress</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {targets.map((target) => {
          const percentage = Math.min(Math.round((target.achieved / target.target) * 100), 100)
          const isComplete = percentage >= 100

          return (
            <Card key={target.id} className="hover:shadow-lg transition-all">
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-neutral-900">{target.name}</h3>
                    <p className="text-xs text-neutral-500 mt-1">Target: {target.unit}{target.target.toLocaleString()}</p>
                  </div>
                  <div className={`flex size-10 items-center justify-center rounded-xl ${isComplete ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-700'}`}>
                    {isComplete ? <CheckCircle2 className="size-5" /> : <Target className="size-5" />}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold text-neutral-900">{target.unit}{target.achieved.toLocaleString()}</p>
                      <p className="text-xs text-neutral-500">Achieved</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${isComplete ? 'text-green-600' : 'text-primary-600'}`}>{percentage}%</p>
                      <p className="text-xs text-neutral-400">of target</p>
                    </div>
                  </div>

                  <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-primary-400 to-primary-600'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="mt-6">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Overall Performance</h3>
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <p className="text-sm text-neutral-600 mb-2">This month's overall progress</p>
                <div className="h-4 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600"
                    style={{ width: '88%' }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-neutral-900">88%</p>
                <p className="text-sm text-neutral-500">Overall Score</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
