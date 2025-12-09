import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { CircularProgress, Alert, Box } from "@mui/material";
import { toast } from "react-toastify";

const GmeetCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleGmeetCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");

        if (!code) {
          throw new Error("No authorization code received from Gmeet");
        }
        console.log("code", code);
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/gmeet/callback`,
          { code },
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (response.data.success) {
          navigate("/profile?tab=connections", {
            state: { message: "Gmeet account connected successfully" },
          });
          toast.success("Gmeet account connected successfully");
          // window.location.href = '/profile?tab=connections&success=true&provider=gmeet';
        }
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to connect Gmeet account"
        );
        toast.error("Failed to connect Gmeet account");
        // Navigate back to settings after error
        setTimeout(() => {
          navigate("/profile?tab=connections");
        }, 3000);
      }
    };

    handleGmeetCallback();
  }, [navigate]);

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <CircularProgress />
    </Box>
  );
};

export default GmeetCallback;
