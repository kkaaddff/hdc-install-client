import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Table, Button, Input, Space, message, Modal, Form } from 'antd'
import { ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons'
import './App.css'

interface DataItem {
  key: string
  name: string
  description: string
}

function App() {
  const [messageApi, contextHolder] = message.useMessage()
  const [loading] = useState(false)
  const [executeLoading, setExecuteLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [currentItem, setCurrentItem] = useState<DataItem | null>(null)
  const [form] = Form.useForm()
  const [dataSource] = useState<DataItem[]>([
    {
      key: '1',
      name: '测试命令1',
      description: '这是一个测试命令',
    },
    {
      key: '2',
      name: '测试命令2',
      description: '这是另一个测试命令',
    },
  ])

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: DataItem) => (
        <Space size='middle'>
          <Button
            type='primary'
            icon={<PlayCircleOutlined />}
            onClick={() => showExecuteModal(record)}>
            执行
          </Button>
        </Space>
      ),
    },
  ]

  const showExecuteModal = (record: DataItem) => {
    setCurrentItem(record)
    setModalVisible(true)
    form.resetFields()
  }

  const handleExecute = async () => {
    try {
      const values = await form.validateFields()
      setExecuteLoading(true)

      // 将参数转换为数组
      const args = values.args.split(' ').filter(Boolean)

      try {
        const result = await invoke('call_hdc', { args })
        messageApi.success('执行成功')
        Modal.success({
          title: '执行结果',
          content: <pre>{result as string}</pre>,
        })
      } catch (error) {
        messageApi.error(`执行失败: ${error}`)
      } finally {
        setExecuteLoading(false)
        setModalVisible(false)
      }
    } catch (error) {
      // 表单验证失败
    }
  }

  return (
    <div className='container'>
      {contextHolder}
      <h1>命令执行工具</h1>

      <div className='table-container'>
        <div className='table-header'>
          <Button
            type='primary'
            icon={<ReloadOutlined />}
            onClick={() => messageApi.info('刷新数据')}>
            刷新
          </Button>
        </div>

        <Table columns={columns} dataSource={dataSource} loading={loading} pagination={false} />
      </div>

      <Modal
        title={`执行命令: ${currentItem?.name}`}
        open={modalVisible}
        onOk={handleExecute}
        onCancel={() => setModalVisible(false)}
        confirmLoading={executeLoading}>
        <Form form={form} layout='vertical'>
          <Form.Item
            name='args'
            label='命令参数'
            rules={[{ required: true, message: '请输入命令参数' }]}>
            <Input placeholder='请输入参数，多个参数用空格分隔' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default App
