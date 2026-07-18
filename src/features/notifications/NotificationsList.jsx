import { useState } from 'react'
import { Bell, CheckCircle, AlertCircle, Info, Trash2 } from 'lucide-react'
import Card from '../../components/ui/Card'

const initialNotifications = [
  { id: 1, type: 'alert', title: 'Low Stock Alert', message: '500ml Water bottles are running low (200 left)', read: false, time: '5 min ago' },
  { id: 2, type: 'success', title: 'Order Delivered', message: 'Order #1234 has been delivered to customer', read: true, time: '1 hour ago' },
  { id: 3, type: 'info', title: 'New User Added', message: 'A new sales officer has been added to the system', read: true, time: '3 hours ago' },
  { id: 4, type: 'alert', title: 'Payment Due', message: 'Payment to supplier is due tomorrow', read: false, time: 'Yesterday' },
]

export default function NotificationsList() {
  const [notifications, setNotifications] = useState(initialNotifications)

  const markAsRead = (id) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const deleteNotification = (id) => {
    setNotifications(notifications.filter(n => n.id !== id))
  }

  const getIcon = (type) => {
    switch (type) {
      case 'success': return CheckCircle
      case 'alert': return AlertCircle
      default: return Info
    }
  }

  const getColorClass = (type) => {
    switch (type) {
      case 'success': return 'text-green-600 bg-green-50'
      case 'alert': return 'text-red-600 bg-red-50'
      default: return 'text-blue-600 bg-blue-50'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Notifications</h1>
          <p className="text-sm text-neutral-500">You have {notifications.filter(n => !n.read).length} unread notifications</p>
        </div>
      </div>

      <div className="space-y-4">
        {notifications.map((notification) => {
          const Icon = getIcon(notification.type)
          return (
            <Card key={notification.id} className={!notification.read ? 'border-l-4 border-l-primary-500' : ''}>
              <div className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`flex size-10 items-center justify-center rounded-xl ${getColorClass(notification.type)}`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-neutral-900">{notification.title}</h3>
                        <p className="text-sm text-neutral-600 mt-1">{notification.message}</p>
                        <p className="text-xs text-neutral-400 mt-2">{notification.time}</p>
                      </div>
                      <div className="flex gap-1">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-2 text-neutral-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                          >
                            <CheckCircle className="size-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
