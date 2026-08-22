-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Máy chủ: 127.0.0.1
-- Thời gian đã tạo: Th2 10, 2025 lúc 11:21 AM
-- Phiên bản máy phục vụ: 10.4.32-MariaDB
-- Phiên bản PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Cơ sở dữ liệu: `bot-zalo-dqt`
--

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `account`
--

CREATE TABLE `account` (
  `id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `is_admin` tinyint(1) DEFAULT 0,
  `vnd` bigint(20) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `account`
--

INSERT INTO `account` (`id`, `username`, `password`, `is_admin`, `vnd`) VALUES
(1, '1', '1', 0, 0);

-- --------------------------------------------------------

--
-- Cấu trúc bảng cho bảng `players_zalo`
--

CREATE TABLE `players_zalo` (
  `id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `idUserZalo` varchar(255) DEFAULT '-1',
  `playerName` varchar(255) NOT NULL,
  `balance` bigint(20) DEFAULT 10000,
  `registrationTime` datetime DEFAULT NULL,
  `totalWinnings` bigint(20) DEFAULT 0,
  `totalLosses` bigint(20) DEFAULT 0,
  `netProfit` bigint(20) DEFAULT 0,
  `totalWinGames` bigint(20) DEFAULT 0,
  `totalGames` bigint(20) DEFAULT 0,
  `winRate` decimal(5,2) DEFAULT 0.00,
  `lastDailyReward` datetime DEFAULT NULL,
  `isBanned` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Đang đổ dữ liệu cho bảng `players_zalo`
--

INSERT INTO `players_zalo` (`id`, `username`, `idUserZalo`, `playerName`, `balance`, `registrationTime`, `totalWinnings`, `totalLosses`, `netProfit`, `totalWinGames`, `totalGames`, `winRate`, `lastDailyReward`, `isBanned`) VALUES
(1, '1', '774150540162926125', '𓂄𓆩𑁍𓆪𓂁 𒈒𒅒 Huyền ッ Sumo 乡 𝄞', 10000, '2025-02-09 13:11:50', 0, 0, 0, 0, 0, 0.00, NULL, 0);

--
-- Chỉ mục cho các bảng đã đổ
--

--
-- Chỉ mục cho bảng `account`
--
ALTER TABLE `account`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- Chỉ mục cho bảng `players_zalo`
--
ALTER TABLE `players_zalo`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT cho các bảng đã đổ
--

--
-- AUTO_INCREMENT cho bảng `account`
--
ALTER TABLE `account`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT cho bảng `players_zalo`
--
ALTER TABLE `players_zalo`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
