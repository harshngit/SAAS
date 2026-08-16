import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle, CheckCheck, Info, RotateCw } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { Bell } from 'lucide-react'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/notifications'

function getIcon(type) {
  if (type === 'success') return CheckCircle
  if (type === 'alert' || type === 'warning') return AlertCircle
  return Info
}

function getColorClass(type) {
  if (type === 'success') return 'text-green-600 bg-green-50'
  if (type === 'alert' || type === 'warning') return 'text-red-600 bg-red-50'
  return 'text-blue-600 bg-blue-50'
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function NotificationsList() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isMarkingAll, setIsMarkingAll] = useState(false)

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    setError('')

    const result = await listNotifications()

    if (!result.success) {
      setNotifications([])
      setError(result.error)
      setIsLoading(false)
      return
    }

    setNotifications(result.notifications)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const markAsRead = async (notification) => {
    if (notification.isRead) return
    const result = await markNotificationRead(notification.id)
    if (result.success) {
      setNotifications((current) => current.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)))
    }
  }

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true)
    const result = await markAllNotificationsRead()
    setIsMarkingAll(false)

    if (result.success) {
      setNotifications((current) => current.map((n) => ({ ...n, isRead: true })))
    }
  }

  const handleClick = (notification) => {
    markAsRead(notification)
    if (notification.link) navigate(notification.link)
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Notifications</h1>
          <p className="text-sm text-neutral-500">You have {unreadCount} unread notification(s)</p>
        </div>
        {unreadCount > 0 && (
          <Button type="button" variant="outline" size="sm" loading={isMarkingAll} onClick={handleMarkAllRead}>
            <CheckCheck className="size-4" aria-hidden="true" />
            Mark all as read
          </Button>
        )}
      </div>

      {error ? (
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={loadNotifications}>
              <RotateCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
          </div>
        </Card>
      ) : isLoading ? (
        <Card><LoadingSpinner label="Loading notifications..." /></Card>
      ) : notifications.length === 0 ? (
        <Card>
          <EmptyState icon={Bell} title="No notifications" description="You're all caught up." />
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => {
            const Icon = getIcon(notification.type)
            return (
              <button
                type="button"
                key={notification.id}
                onClick={() => handleClick(notification)}
                className="block w-full text-left"
              >
                <Card className={!notification.isRead ? 'border-l-4 border-l-primary-500' : ''}>
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`flex size-10 items-center justify-center rounded-xl ${getColorClass(notification.type)}`}>
                        <Icon className="size-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-neutral-900">{notification.title}</h3>
                        <p className="mt-1 text-sm text-neutral-600">{notification.body}</p>
                        <p className="mt-2 text-xs text-neutral-400">{formatTime(notification.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
