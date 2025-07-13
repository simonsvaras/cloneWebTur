<?php
$current_subject = "general";
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['username']) || !isset($data['JSONdata'])) {
        http_response_code(400);
        echo "Invalid input";
        exit;
    }
    
    $username = preg_replace('/[^a-zA-Z0-9_]/', '', $data['username']); // Sanitize username
    $timestamp = date('Y-m-d_H-i-s');
    $filename = "collected/{$current_subject}_{$username}_{$timestamp}.json";
    
    if (!is_dir('collected')) {
        mkdir('collected', 0777, true);
    }
    
    file_put_contents($filename, json_encode($data, JSON_PRETTY_PRINT));
    echo "Data stored successfully.";
} else {
    http_response_code(405);
    echo "Method not allowed";
}
