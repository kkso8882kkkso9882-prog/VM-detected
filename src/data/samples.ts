export interface SampleScript {
  id: string;
  name: string;
  category: string;
  description: string;
  code: string;
}

export const SAMPLE_SCRIPTS: SampleScript[] = [
  {
    id: 'roblox-ironbrew-vm',
    name: 'IronBrew / PSU Virtualized Remote Dispatcher',
    category: 'Heavily Virtualized VM',
    description: 'Contains a while-true dispatcher, 32-bit bitfield unpacking (bit32.band), state machine, encrypted XOR string pool, and Roblox RemoteEvent network triggers.',
    code: `--[[ 
  OBFUSCATED ROBLOX LUAU VM PAYLOAD (IRONBREW/PSU ARCHETYPE)
  Protected with Control Flow Flattening, Dynamic State Dispatcher,
  Encrypted String Pool, and Bytecode Virtualization
--]]

local _ENV = getfenv and getfenv() or _G
local bit = bit32 or bit

-- Encrypted String Pool
local Strings = {
  "\\x30\\x0c\\x01\\x19\\x05\\x12\\x13", -- 'Players' (XOR 0x42)
  "\\x2e\\x0d\\x01\\x19\\x0e\\x32\\x0e\\x01\\x19\\x07\\x12", -- 'LocalPlayer' (XOR 0x42)
  "\\x30\\x07\\x10\\x0e\\x01\\x03\\x01\\x14\\x07\\x21\\x16\\x0d\\x10\\x03\\x07", -- 'ReplicatedStorage' (XOR 0x42)
  "\\x26\\x07\\x0f\\x0d\\x16\\x07\\x27\\x14\\x07\\x0c\\x16", -- 'RemoteEvent' (XOR 0x42)
  "\\x24\\x0b\\x10\\x07\\x31\\x07\\x10\\x14\\x07\\x10" -- 'FireServer' (XOR 0x42)
}

local function _decode_str(str)
  local key = 0x42
  local res = ""
  for i = 1, #str do
    res = res .. string.char(bit.bxor(string.byte(str, i), key))
  end
  return res
end

-- Virtual Bytecode Instruction Stream (32-bit instructions)
local bytecode = {
  0x00000003, -- LOAD_CONSTANT R[0], K[0] ("Players")
  0x00000045, -- GET_GLOBAL R[1], "game"
  0x00000086, -- CALL R[1], "GetService"
  0x000000C1, -- GET_TABLE R[2], R[1]["LocalPlayer"]
  0x00000103, -- LOAD_CONSTANT R[3], K[1] ("RemoteEvent")
  0x00000147, -- CALL R[3], "FireServer" (Payload)
  0x00000188  -- RETURN R[0]
}

local Constants = {
  _decode_str(Strings[1]),
  _decode_str(Strings[2]),
  _decode_str(Strings[3]),
  _decode_str(Strings[4]),
  1000,
  "GiveCoins"
}

-- Virtual Machine Execution Engine
local function VM_Execute()
  local R = {}
  local PC = 1
  local State = 0x100 -- Initial Dispatch State

  while true do
    -- State Machine Dispatcher with Opaque Predicates
    if State == 0x100 then
      -- Opaque identity predicate (x == x is always true)
      if (123 == 123) then
        local inst = bytecode[PC]
        local op = bit.band(inst, 0x3F)
        PC = PC + 1
        State = 0x200 + op
      else
        State = 0xDEAD
      end

    elseif State == 0x203 then -- OP_LOAD_CONSTANT
      local a = 0
      local bx = 1
      R[a] = Constants[bx]
      State = 0x100

    elseif State == 0x245 then -- OP_GET_GLOBAL
      local a = 1
      local serviceName = Constants[1]
      R[a] = game:GetService(serviceName)
      State = 0x100

    elseif State == 0x286 then -- OP_CALL (Roblox Service/Method)
      local players = game:GetService("Players")
      local lp = players.LocalPlayer
      R[2] = lp
      State = 0x100

    elseif State == 0x2C1 then -- OP_GET_TABLE
      local rep = game:GetService("ReplicatedStorage")
      R[3] = rep:WaitForChild("NetworkRemote")
      State = 0x100

    elseif State == 0x247 then -- OP_CALL_REMOTE (FireServer)
      local remote = R[3]
      if remote and remote.FireServer then
        remote:FireServer("ClaimDailyReward", 5000)
      end
      State = 0x100

    elseif State == 0x288 then -- OP_RETURN
      return R[0]

    else
      -- Unreachable trap state
      break
    end
  end
end

VM_Execute()
`
  },
  {
    id: 'nested-opaque-predicates',
    name: 'Opaque Predicates & Control Flow Tree',
    category: 'Opaque Predicates & Flattening',
    description: 'Features nested if/elseif condition chains, arithmetic identities (x ~= x, bit32 masks), dead code branches, and constant folding arithmetic.',
    code: `--[[
  ROBLOX LUAU SCRIPT WITH HEAVY OPAQUE PREDICATES & CONTROL FLOW TREES
--]]

local bit = bit32 or bit

local a = 10
local b = a + 20 -- Constant propagation target (30)
local c = b * 4   -- Constant propagation target (120)

local targetState = 0x50

while targetState ~= 0x999 do
  -- Opaque Identity Predicate (Always False)
  if (c ~= c) then
    print("UNREACHABLE DEAD BLOCK 1")
    targetState = 0x0
  elseif (targetState == 0x50) then
    -- Real Path
    local character = workspace:FindFirstChild("PlayerModel")
    if (100 > 50) then -- Constant boolean predicate (Always True)
      local humanoid = character and character:FindFirstChild("Humanoid")
      if humanoid then
        humanoid.WalkSpeed = 32
        humanoid.JumpPower = 75
      end
      targetState = 0x60
    else
      print("UNREACHABLE DEAD BLOCK 2")
      targetState = 0x999
    end

  elseif (targetState == 0x60) then
    -- Bitwise constant folding (bit.band(0xFF, 0x0F) -> 15)
    local mask = bit.band(0xFF, 0x0F)
    if mask == 15 then
      local TweenService = game:GetService("TweenService")
      local RunService = game:GetService("RunService")
      targetState = 0x999 -- Terminate loop
    else
      targetState = 0x70
    end
  else
    targetState = 0x999
  end
end
`
  },
  {
    id: 'luraph-table-dispatcher',
    name: 'Luraph-Style Table Dispatcher & Register Bank',
    category: 'Table Dispatcher & Register VM',
    description: 'Implements indirect function table indexing (T.H[opcode]), virtual registers R[0]..R[n], stack pushes, and HumanoidRootPart CFrame teleportation.',
    code: `--[[
  LURAPH / MOONSEC STYLE TABLE-DRIVEN DISPATCHER
  Indirect function lookup: T.H[opcode](inst)
--]]

local T = {}
T.H = {} -- Opcode handler function table
T.R = {} -- Virtual registers
T.Const = {
  [1] = "Workspace",
  [2] = "Players",
  [3] = "HumanoidRootPart",
  [4] = 100,
  [5] = 50
}

-- Handler 1: OP_LOAD_CONST
T.H[1] = function(inst)
  local a = inst[2]
  local bx = inst[3]
  T.R[a] = T.Const[bx]
end

-- Handler 2: OP_GET_GLOBAL
T.H[2] = function(inst)
  local a = inst[2]
  local globalName = T.Const[inst[3]]
  T.R[a] = game:GetService(globalName)
end

-- Handler 3: OP_SET_TABLE (CFrame Teleportation)
T.H[3] = function(inst)
  local players = game:GetService("Players")
  local localPlayer = players.LocalPlayer
  local char = localPlayer.Character
  if char then
    local hrp = char:FindFirstChild("HumanoidRootPart")
    if hrp then
      hrp.CFrame = CFrame.new(0, 100, 0)
    end
  end
end

-- Handler 4: OP_ADD
T.H[4] = function(inst)
  local a = inst[2]
  local b = inst[3]
  local c = inst[4]
  T.R[a] = T.R[b] + T.R[c]
end

-- Handler 5: OP_RETURN
T.H[5] = function(inst)
  return T.R[inst[2]]
end

-- Bytecode array of instruction descriptors
local instructions = {
  {1, 0, 4},       -- R[0] = 100
  {1, 1, 5},       -- R[1] = 50
  {4, 2, 0, 1},    -- R[2] = R[0] + R[1] (150)
  {2, 3, 2},       -- R[3] = game:GetService("Players")
  {3, 0, 0, 0},    -- Teleport Character
  {5, 2, 0}        -- Return R[2]
}

local pc = 1
while pc <= #instructions do
  local inst = instructions[pc]
  local opcode = inst[1]
  local handler = T.H[opcode]
  if handler then
    handler(inst)
  end
  pc = pc + 1
end
`
  },
  {
    id: 'encoded-string-pool-xor',
    name: 'Multi-layer Byte Shifting & Entropy Pool',
    category: 'String Decryption & Crypto',
    description: 'Demonstrates high-entropy encoded blobs, byte extraction, Shannon entropy calculation, custom byte mapping, and RemoteFunction invoke.',
    code: `--[[
  HIGH ENTROPY STRING POOL DECODER WITH ROBLOX REMOTE INVOCATION
--]]

local EncryptedBlob = "\\x68\\x74\\x74\\x70\\x73\\x3a\\x2f\\x2f\\x61\\x70\\x69\\x2e\\x72\\x6f\\x62\\x6c\\x6f\\x78\\x2e\\x63\\x6f\\x6d"
local RemoteKeyBlob = "\\x47\\x65\\x74\\x50\\x6c\\x61\\x79\\x65\\x72\\x44\\x61\\x74\\x61"

local function decrypt_byte_stream(blob)
  local output = ""
  for i = 1, #blob do
    local b = string.byte(blob, i)
    -- Byte shift by 0 (Plaintext extraction pattern)
    output = output .. string.char(b)
  end
  return output
end

local function execute_remote_hook()
  local HttpService = game:GetService("HttpService")
  local ReplicatedStorage = game:GetService("ReplicatedStorage")
  
  local remoteName = decrypt_byte_stream(RemoteKeyBlob)
  local targetRemote = ReplicatedStorage:WaitForChild(remoteName)
  
  if targetRemote and targetRemote.InvokeServer then
    local response = targetRemote:InvokeServer({
      AuthToken = "0xDEADBEEF",
      Action = "SyncProfile"
    })
    return response
  end
end

execute_remote_hook()
`
  }
];
