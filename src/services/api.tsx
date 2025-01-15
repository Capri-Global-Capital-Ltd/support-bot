// src/services/api.ts

import axios, { AxiosError } from 'axios';

// Types
export interface NetworkRequest {
    url: string;
    method: string;
    status: number;
    duration: number;
    timestamp: string;
    error?: string;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBody?: string;
    responseBody?: string;
}

export interface SupportTicketRequest {
    description: string;
    screenshot?: string;
    failedRequests: NetworkRequest[];
    timestamp: string;
    userAgent?: string;
    browserInfo?: {
        name: string;
        version: string;
        os: string;
    };
}

export interface TicketResponse {
    ticketId: string;
    status: string;
    message: string;
    assignedTo?: string;
    priority?: string;
    expectedResponseTime?: string;
}

// API Configuration
const API_CONFIG = {
    baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:18000',
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    }
};

// Create axios instance
const apiClient = axios.create(API_CONFIG);

// Error handling
export class APIError extends Error {
    status: number;
    data?: any;

    constructor(message: string, status: number, data?: any) {
        super(message);
        this.status = status;
        this.data = data;
        this.name = 'APIError';
    }
}

// Request interceptor
apiClient.interceptors.request.use(
    (config) => {
        // Add user agent and browser info
        const browserInfo = getBrowserInfo();
        config.headers['User-Agent'] = navigator.userAgent;
        config.headers['X-Browser-Info'] = JSON.stringify(browserInfo);
        return config;
    },
    (error) => {
        return Promise.reject(new APIError(error.message, 0));
    }
);

// Response interceptor
apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        if (error.response) {
            throw new APIError(
                error.response.data?.message || 'Server error',
                error.response.status,
                error.response.data
            );
        }
        throw new APIError(error.message, 0);
    }
);

// Helper function to get browser information
function getBrowserInfo() {
    const ua = navigator.userAgent;
    let browserName = "Unknown";
    let browserVersion = "Unknown";
    let os = "Unknown";

    // Detect browser
    if (ua.includes("Firefox/")) {
        browserName = "Firefox";
        browserVersion = ua.split("Firefox/")[1];
    } else if (ua.includes("Chrome/")) {
        browserName = "Chrome";
        browserVersion = ua.split("Chrome/")[1].split(" ")[0];
    } else if (ua.includes("Safari/")) {
        browserName = "Safari";
        browserVersion = ua.split("Version/")[1].split(" ")[0];
    }

    // Detect OS
    if (ua.includes("Windows")) {
        os = "Windows";
    } else if (ua.includes("Mac")) {
        os = "MacOS";
    } else if (ua.includes("Linux")) {
        os = "Linux";
    }

    return { name: browserName, version: browserVersion, os };
}

// API endpoints
export const supportApi = {
    // Create support ticket
    createTicket: async (data: SupportTicketRequest): Promise<TicketResponse> => {
        try {
            const response = await apiClient.post<TicketResponse>('/api/support-ticket', {
                ...data,
                browserInfo: getBrowserInfo(),
                userAgent: navigator.userAgent
            });
            return response.data;
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError('Failed to create ticket', 500);
        }
    },

    // Get ticket status
    getTicketStatus: async (ticketId: string): Promise<TicketResponse> => {
        try {
            const response = await apiClient.get<TicketResponse>(`/api/support-ticket/${ticketId}`);
            return response.data;
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError('Failed to get ticket status', 500);
        }
    },

    // Update ticket
    updateTicket: async (ticketId: string, data: Partial<SupportTicketRequest>): Promise<TicketResponse> => {
        try {
            const response = await apiClient.put<TicketResponse>(`/api/support-ticket/${ticketId}`, data);
            return response.data;
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError('Failed to update ticket', 500);
        }
    },

    // Upload additional screenshot
    uploadScreenshot: async (ticketId: string, screenshot: string): Promise<void> => {
        try {
            await apiClient.post(`/api/support-ticket/${ticketId}/screenshot`, { screenshot });
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError('Failed to upload screenshot', 500);
        }
    },

    // Get network statistics
    getNetworkStats: async (): Promise<{
        totalRequests: number;
        failedRequests: number;
        averageResponseTime: number;
    }> => {
        try {
            const response = await apiClient.get('/api/network-stats');
            return response.data;
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError('Failed to get network stats', 500);
        }
    },

    // Health check
    healthCheck: async (): Promise<{ status: string }> => {
        try {
            const response = await apiClient.get('/api/health');
            return response.data;
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            throw new APIError('Health check failed', 500);
        }
    }
};

export default supportApi;