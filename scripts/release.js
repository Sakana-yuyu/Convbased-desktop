#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 读取当前版本
function getCurrentVersion() {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return packageJson.version;
}

// 更新版本号
function updateVersion(newVersion) {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
}

// 执行命令
function exec(command) {
  console.log(`执行: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`命令执行失败: ${command}`);
    process.exit(1);
  }
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('使用方法:');
    console.log('  node scripts/release.js <version>');
    console.log('  例如: node scripts/release.js 1.3.5');
    console.log('');
    console.log('当前版本:', getCurrentVersion());
    return;
  }
  
  const newVersion = args[0];
  const currentVersion = getCurrentVersion();
  
  console.log(`准备发布新版本: ${currentVersion} -> ${newVersion}`);
  
  // 确认发布
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('确认发布? (y/N): ', (answer) => {
    rl.close();
    
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('发布已取消');
      return;
    }
    
    try {
      // 更新版本号
      console.log('\n1. 更新版本号...');
      updateVersion(newVersion);
      
      // 提交更改
      console.log('\n2. 提交版本更新...');
      exec('git add package.json');
      exec(`git commit -m "chore: bump version to ${newVersion}"`);
      
      // 创建标签
      console.log('\n3. 创建版本标签...');
      exec(`git tag -a v${newVersion} -m "Release v${newVersion}"`);
      
      // 推送到远程
      console.log('\n4. 推送到远程仓库...');
      exec('git push origin main');
      exec(`git push origin v${newVersion}`);
      
      console.log('\n✅ 发布完成!');
      console.log('GitHub Actions 将自动构建并发布新版本。');
      console.log(`查看发布状态: https://github.com/your-username/your-repo/actions`);
      
    } catch (error) {
      console.error('\n❌ 发布失败:', error.message);
      process.exit(1);
    }
  });
}

if (require.main === module) {
  main();
}

module.exports = { getCurrentVersion, updateVersion };