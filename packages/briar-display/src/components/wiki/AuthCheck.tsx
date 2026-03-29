'use client'

import { useRouter } from 'astro:transitions/client'
import { Button } from '@/components/ui/button'
import React, { useState, useEffect } from 'react'

interface AuthCheckProps {
	onAuthorized: () => void
	onUnauthorized: () => void
}

export default function AuthCheck({ onAuthorized, onUnauthorized }: AuthCheckProps) {
	const [isChecking, setIsChecking] = useState(true)
	const [isAuthorized, setIsAuthorized] = useState(false)

	useEffect(() => {
		checkAuth()
	}, [])

	const checkAuth = async () => {
		try {
			// Check if user has a token in localStorage
			const token = typeof window !== 'undefined' ? localStorage.getItem('briar_token') : null

			if (token) {
				setIsAuthorized(true)
				onAuthorized()
			} else {
				setIsAuthorized(false)
				onUnauthorized()
			}
		} catch (error) {
			console.error('Auth check error:', error)
			setIsAuthorized(false)
			onUnauthorized()
		} finally {
			setIsChecking(false)
		}
	}

	if (isChecking) {
		return (
			<div className="flex justify-center items-center p-8">
				<p>Checking authorization...</p>
			</div>
		)
	}

	if (!isAuthorized) {
		return (
			<div className="max-w-4xl mx-auto p-4">
				<div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
					<h2 className="text-xl font-bold text-blue-900 mb-2">Sign In Required</h2>
					<p className="text-blue-700 mb-4">You need to be signed in to create or edit articles.</p>
					<Button asChild>
						<a href="/briar-display/login">Sign In</a>
					</Button>
				</div>
			</div>
		)
	}

	return null
}
