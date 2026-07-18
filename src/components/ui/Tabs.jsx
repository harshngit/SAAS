import * as React from 'react'

const TabsContext = React.createContext({})

function Tabs({ defaultValue, value, onValueChange, children, className, ...props }) {
  const [activeTab, setActiveTab] = React.useState(value || defaultValue)

  const handleValueChange = React.useCallback(
    (newValue) => {
      setActiveTab(newValue)
      if (onValueChange) {
        onValueChange(newValue)
      }
    },
    [onValueChange]
  )

  const contextValue = React.useMemo(
    () => ({
      activeTab,
      setActiveTab: handleValueChange,
    }),
    [activeTab, handleValueChange]
  )

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={className} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({ children, className, ...props }) {
  return (
    <div
      className={`inline-flex h-10 items-center justify-center rounded-full bg-neutral-100 p-1 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

function TabsTrigger({ value, children, className, ...props }) {
  const { activeTab, setActiveTab } = React.useContext(TabsContext)
  const isActive = activeTab === value

  return (
    <button
      type="button"
      onClick={() => setActiveTab(value)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-50 ${
        isActive
          ? 'bg-white text-primary-700 shadow-(--shadow-xs)'
          : 'text-neutral-500 hover:text-neutral-900'
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

function TabsContent({ value, children, className, ...props }) {
  const { activeTab } = React.useContext(TabsContext)
  if (activeTab !== value) return null

  return (
    <div className={className} {...props}>
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
