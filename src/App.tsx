import './App.css'
import { Outlet } from 'react-router-dom'

function App() {

  return (
    <div>
      <h1>
        <Outlet />
      </h1>
    </div>
  )
}

export default App