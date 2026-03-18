import { useState } from 'react'

export function useSelectionState() {
  const [selectedCity, setSelectedCity] = useState(null)
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [selectedTrainSet, setSelectedTrainSet] = useState(null)

  function selectCity(city) {
    if (selectedCity?.id === city.id) {
      setSelectedCity(null)
    } else {
      setSelectedCity(city)
      setSelectedRoute(null)
    }
  }

  function selectRoute(route) {
    if (selectedRoute?.id === route.id) {
      setSelectedRoute(null)
    } else {
      setSelectedRoute(route)
      setSelectedCity(null)
      setSelectedTrainSet(null)
    }
  }

  function selectTrainSet(trainSet) {
    if (selectedTrainSet?.id === trainSet?.id) {
      setSelectedTrainSet(null)
    } else {
      setSelectedTrainSet(trainSet)
      setSelectedCity(null)
      setSelectedRoute(null)
    }
  }

  return { selectedCity, selectedRoute, selectedTrainSet, selectCity, selectRoute, selectTrainSet, setSelectedRoute }
}
