import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logout } from "../store/slices/authSlice";

const useHttp = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const sendRequest = async (requestConfig, applyData) => {
        setIsLoading(true);
        setError(null);

        if(window.location.pathname.includes('reset-password')){
            return;
          }

        try {
            const response = await fetch(requestConfig.url, {
                method: requestConfig.method ? requestConfig.method : 'GET',
                headers: requestConfig.headers ? requestConfig.headers : {},
                body: requestConfig.body ? JSON.stringify(requestConfig.body) : null,
            });

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                dispatch(logout());
                navigate('/');
                throw new Error('Authentication failed. Please login again.');
            }



            if (response.status === 204) {
                return;
            }

            const data = await response.json();
            
            if (applyData) {
                applyData(data);
            }

            return data;
        } catch (err) {
            setError(err.message || 'Something went wrong!');
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isLoading,
        error,
        sendRequest,
        clearError: () => setError(null)
    };
};

export default useHttp;