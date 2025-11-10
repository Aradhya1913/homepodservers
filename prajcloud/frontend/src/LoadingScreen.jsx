import React from "react";
import { motion } from "framer-motion";

export default function LoadingScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="flex justify-center items-center h-screen bg-black text-white text-2xl"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="border-4 border-t-orange-400 border-gray-700 rounded-full w-12 h-12 mr-4"
      />
      Loading your Server...
    </motion.div>
  );
}