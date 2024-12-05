import React, { useState, useEffect, useRef } from "react";
import "./styles.css";

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [transcription, setTranscription] = useState("");
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Use useRef for audioChunks to persist across renders
  const audioChunksRef = useRef([]);

  useEffect(() => {
    const setupMediaRecorder = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data); // Push data to ref
          }
        };

        recorder.onstop = async () => {
          if (audioChunksRef.current.length === 0) {
            setError("No audio data captured.");
            return;
          }

          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          audioChunksRef.current = []; // Clear chunks for the next recording
          await sendAudioToBackend(audioBlob);
        };

        setMediaRecorder(recorder);
      } catch (err) {
        console.error("Error setting up MediaRecorder:", err);
        setError("Microphone access denied.");
      }
    };

    if (navigator.mediaDevices?.getUserMedia) {
      setupMediaRecorder();
    } else {
      setError("Your browser does not support audio recording.");
    }
  }, []);

  const handleRecordingToggle = () => {
    setError("");
    if (mediaRecorder) {
      if (isRecording) {
        mediaRecorder.stop();
      } else {
        mediaRecorder.start();
      }
      setIsRecording((prev) => !prev);
    }
  };

  const sendAudioToBackend = async (audioBlob) => {
    console.log("Sending audio with size: ", audioBlob.size);
   
    if (audioBlob.size === 0) {
      setError("Audio file is empty.");
      return;
    }
   
    setIsLoading(true);
    const formData = new FormData();
    formData.append("userId", 1);  // Replace with actual user ID
    formData.append("audio", audioBlob, "audio.webm");
   
    try {
      const response = await fetch("http://localhost:8080/transcribe-audio", {
        method: "POST",
        body: formData,
      });
   
      if (!response.ok) {
        throw new Error("Failed to upload audio to backend.");
      }
   
      const data = await response.json();
   
      if (data?.sucessfull) {
        // Access transcriptionText from data.data
        if (data.data?.transcriptionText) {
          setTranscription(data.data.transcriptionText || "No transcription available.");
        } else {
          setError("No transcription text received.");
        }
      } else {
        setError("Failed to transcribe the audio.");
      }
    } catch (err) {
      console.error("Error while sending audio to backend:", err);
      setError("Error while sending audio to backend.");
    } finally {
      setIsLoading(false);
    }
  };

  const summarizeText = async () => {
    if (!transcription) {
      setError("No transcription available to summarize.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:8080/summararize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: transcription }),  // Pass transcription text as "content"
      });

      if (!response.ok) {
        throw new Error("Failed to summarize transcription.");
      }

      const data = await response.json();
      if (data?.sucessfull) {
        // Set the summary content from the response
        setSummary(data.data.content || "No summary available.");
      } else {
        setError("Failed to summarize the transcription.");
      }
    } catch (err) {
      console.error("Error while sending transcription for summarization:", err);
      setError("Error while sending transcription for summarization.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="audio-recorder-container">
      <button
        onClick={handleRecordingToggle}
        className={`record-button ${isRecording ? "recording" : ""}`}
      >
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>

      {isLoading && <p className="status-message">Processing...</p>}
      {error && <p className="error-message">{error}</p>}

      {transcription && (
        <div className="result-section">
          <h3>Transcription:</h3>
          <p>{transcription}</p>
          <button onClick={summarizeText} className="summarize-button">
            Summarize Message
          </button>
        </div>
      )}

      {summary && (
        <div className="summary-section">
          <h3>Summary:</h3>
          <p>{summary}</p>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
