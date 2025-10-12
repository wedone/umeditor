<?php
header('Content-Type: application/json; charset=utf-8');
// 简单示例：接收 POST 或 GET 的 id 参数，返回 latex 字符串
$id = isset($_POST['id']) ? $_POST['id'] : (isset($_GET['id']) ? $_GET['id'] : '');

$sample = '\\sqrt{1+\\frac{a}{b}}';

// 你可以根据 $id 去数据库或文件加载不同内容
echo json_encode(array('latex' => $sample), JSON_UNESCAPED_UNICODE);

?>
